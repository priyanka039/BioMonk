import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/admin-supabase";
import {
    BACKUP_TABLES,
    BACKUP_DIR,
    BACKUP_RETENTION_WEEKS,
    type BackupFile,
} from "@/lib/backup-tables";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false; // fail closed if not configured
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true; // Vercel Cron sends this
    if (req.nextUrl.searchParams.get("secret") === secret) return true; // manual trigger
    return false;
}

export async function GET(req: NextRequest) {
    if (!authorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const t0 = Date.now();
    const supa = getAdminClient();

    try {
        // 1) Export each table.
        const tables: Record<string, unknown[]> = {};
        for (const table of BACKUP_TABLES) {
            const { data, error } = await supa.from(table).select("*");
            if (error) {
                log.error("backup.table_failed", { table, error: error.message });
                return NextResponse.json(
                    { error: `Failed exporting ${table}: ${error.message}` },
                    { status: 500 }
                );
            }
            tables[table] = data || [];
        }

        const payload: BackupFile = {
            generatedAt: new Date().toISOString(),
            version: 1,
            tables,
        };
        const stamp = payload.generatedAt.replace(/[:.]/g, "-");
        const filePath = `${BACKUP_DIR}/${stamp}.json`;

        // 2) Upload JSON to storage.
        const { error: upErr } = await supa.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, JSON.stringify(payload), {
                contentType: "application/json",
                upsert: true,
            });
        if (upErr) {
            log.error("backup.upload_failed", { error: upErr.message });
            return NextResponse.json({ error: upErr.message }, { status: 500 });
        }

        // 3) Prune backups older than the retention window.
        let pruned = 0;
        const { data: existing } = await supa.storage
            .from(STORAGE_BUCKET)
            .list(BACKUP_DIR, { limit: 1000 });
        if (existing) {
            const cutoff = Date.now() - BACKUP_RETENTION_WEEKS * 7 * 24 * 60 * 60 * 1000;
            const stale = existing
                .filter((f) => {
                    const created = f.created_at ? new Date(f.created_at).getTime() : NaN;
                    return Number.isFinite(created) ? created < cutoff : false;
                })
                .map((f) => `${BACKUP_DIR}/${f.name}`);
            if (stale.length) {
                await supa.storage.from(STORAGE_BUCKET).remove(stale);
                pruned = stale.length;
            }
        }

        const rowCount = Object.values(tables).reduce((n, rows) => n + rows.length, 0);
        await supa.from("audit_logs").insert({
            action: "backup",
            table_name: "*",
            record_id: filePath,
            admin_email: "system",
            metadata: { rows: rowCount, pruned, durationMs: Date.now() - t0 },
        });
        log.info("backup.completed", {
            filePath,
            rows: rowCount,
            pruned,
            durationMs: Date.now() - t0,
        });

        return NextResponse.json({
            ok: true,
            file: filePath,
            rows: rowCount,
            pruned,
        });
    } catch (e) {
        log.error("backup.exception", { error: e instanceof Error ? e.message : String(e) });
        return NextResponse.json({ error: "Backup failed" }, { status: 500 });
    }
}
