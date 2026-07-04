import { RESTORE_ORDER, type BackupFile } from "./backup-tables";

// Minimal shape of the Supabase client the restore needs. Kept structural so a
// test can pass a fake client (proving the restore logic without a live DB).
export interface RestoreClient {
    from(table: string): {
        select: (
            columns: string,
            opts?: { count?: "exact"; head?: boolean }
        ) => Promise<{ count: number | null; error: { message: string } | null }>;
        upsert: (
            rows: Record<string, unknown>[]
        ) => Promise<{ error: { message: string } | null }>;
    };
}

export interface RestoreTableResult {
    table: string;
    backupRows: number;
    dbRowsBefore: number | null;
    upserted: number;
}

export interface RestoreResult {
    dryRun: boolean;
    tables: RestoreTableResult[];
    totalRows: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// Restores rows table-by-table in FK-safe order using upsert-by-primary-key
// (idempotent). In dry-run mode it counts only and writes nothing.
export async function restoreFromBackup(
    client: RestoreClient,
    backup: BackupFile,
    opts: { dryRun?: boolean } = {}
): Promise<RestoreResult> {
    const dryRun = !!opts.dryRun;
    const tables: RestoreTableResult[] = [];
    let totalRows = 0;

    for (const table of RESTORE_ORDER) {
        const rows = (backup.tables?.[table] as Record<string, unknown>[]) || [];
        totalRows += rows.length;

        const { count } = await client
            .from(table)
            .select("*", { count: "exact", head: true });

        let upserted = 0;
        if (!dryRun && rows.length > 0) {
            for (const batch of chunk(rows, 500)) {
                const { error } = await client.from(table).upsert(batch);
                if (error) {
                    throw new Error(`Failed upserting into ${table}: ${error.message}`);
                }
                upserted += batch.length;
            }
        }

        tables.push({ table, backupRows: rows.length, dbRowsBefore: count ?? null, upserted });
    }

    return { dryRun, tables, totalRows };
}
