import { NextResponse } from "next/server";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/admin-supabase";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/health → 200 only if DB and storage both respond.
export async function GET() {
    const t0 = Date.now();
    const result = { status: "ok", db: false, storage: false };

    try {
        const supa = getAdminClient();
        const { error: dbErr } = await supa.from("admin_users").select("id").limit(1);
        result.db = !dbErr;

        const { error: stErr } = await supa.storage
            .from(STORAGE_BUCKET)
            .list("", { limit: 1 });
        result.storage = !stErr;
    } catch (e) {
        log.error("health.exception", { error: e instanceof Error ? e.message : String(e) });
    }

    const healthy = result.db && result.storage;
    result.status = healthy ? "ok" : "degraded";
    if (!healthy) log.warn("health.degraded", { ...result, durationMs: Date.now() - t0 });

    return NextResponse.json(result, { status: healthy ? 200 : 503 });
}
