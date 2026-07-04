#!/usr/bin/env tsx
/**
 * BioMonk — Backup Restore
 * ========================
 * Restores a JSON backup produced by /api/cron/backup.
 *
 * A backup is worthless until restore is proven — so this is a real, tested
 * developer tool (NOT a client button; "overwrite everything" is itself a risk).
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts --file backups/2026-07-05T....json --dry-run
 *   npx tsx scripts/restore-backup.ts --file ./local-backup.json
 *
 *   --file      Local path OR a storage path inside the bucket (backups/...).
 *   --dry-run   Report counts/diffs and WRITE NOTHING.
 *
 * Env required (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { type BackupFile } from "../lib/backup-tables";
import { restoreFromBackup, type RestoreClient } from "../lib/backup-restore";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const STORAGE_BUCKET = "study-material-bucket";

function arg(flag: string): string | undefined {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
}

const fileArg = arg("--file");
const dryRun = process.argv.includes("--dry-run");

if (!fileArg) {
    console.error(
        "\n  Usage: npx tsx scripts/restore-backup.ts --file <local-or-storage-path> [--dry-run]\n"
    );
    process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supa = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function loadBackup(location: string): Promise<BackupFile> {
    // Prefer a local file when it exists; otherwise download from storage.
    if (fs.existsSync(location)) {
        return JSON.parse(fs.readFileSync(location, "utf8")) as BackupFile;
    }
    const { data, error } = await supa.storage.from(STORAGE_BUCKET).download(location);
    if (error || !data) {
        throw new Error(`Could not read backup at "${location}": ${error?.message || "not found"}`);
    }
    return JSON.parse(await data.text()) as BackupFile;
}

async function main() {
    console.log(`\nBioMonk restore ${dryRun ? "(DRY RUN — no writes)" : "(LIVE)"}\n`);
    const backup = await loadBackup(fileArg!);
    console.log(`Backup generated at: ${backup.generatedAt}`);
    console.log(`Format version:      ${backup.version}\n`);

    const result = await restoreFromBackup(supa as unknown as RestoreClient, backup, { dryRun });

    for (const t of result.tables) {
        console.log(
            `  ${t.table.padEnd(16)} backup=${String(t.backupRows).padStart(5)}  db=${String(
                t.dbRowsBefore ?? "?"
            ).padStart(5)}`
        );
    }

    console.log(`\n${dryRun ? "Would restore" : "Restored"} ${result.totalRows} rows across ${result.tables.length} tables.`);
    if (dryRun) console.log("No changes were made (dry run).\n");
    else console.log("Restore complete.\n");
}

main().catch((e) => {
    console.error("Restore failed:", e instanceof Error ? e.message : e);
    process.exit(1);
});
