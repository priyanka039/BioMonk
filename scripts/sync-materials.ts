#!/usr/bin/env tsx
/**
 * BioMonk — Sync Study Materials from Storage
 * ============================================
 * Lists all PDF files in the Supabase storage bucket "study-material-bucket",
 * checks if each already exists in study_materials, and inserts missing rows.
 *
 * Usage:
 *   npx tsx scripts/sync-materials.ts
 *
 * Env required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BUCKET = "study-material-bucket";

// ─── Supabase admin client ────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("\n  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local\n");
    process.exit(1);
}

const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a storage filename into a human-readable title.
 * "genetics-complete-notes.pdf" → "Genetics Complete Notes"
 */
function titleFromFilename(filename: string): string {
    return filename
        .replace(/\.pdf$/i, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Detects material type from filename.
 */
function typeFromFilename(filename: string): "notes" | "mindmap" | "pyq" | "formula_sheet" {
    const lower = filename.toLowerCase();
    if (lower.includes("mindmap") || lower.includes("mind-map") || lower.includes("mind_map")) return "mindmap";
    if (lower.includes("pyq") || lower.includes("previous")) return "pyq";
    if (lower.includes("formula")) return "formula_sheet";
    return "notes";
}

interface StorageFile {
    name: string;
    path: string;             // full path inside bucket
    size_bytes: number | null;
}

/**
 * Recursively lists all files in a bucket folder.
 */
async function listAllFiles(prefix: string = ""): Promise<StorageFile[]> {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });

    if (error) {
        console.error(`  Error listing ${prefix || "root"}: ${error.message}`);
        return [];
    }

    const files: StorageFile[] = [];

    for (const item of data || []) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

        // Supabase returns folders as items with metadata === null and no size
        const isFolder = item.metadata === null || (!item.metadata?.size && item.id === null);

        if (isFolder) {
            // Recurse into folder
            const subFiles = await listAllFiles(fullPath);
            files.push(...subFiles);
        } else {
            // Only keep PDF files
            if (item.name.toLowerCase().endsWith(".pdf")) {
                files.push({
                    name: item.name,
                    path: fullPath,
                    size_bytes: (item.metadata as any)?.size ?? null,
                });
            }
        }
    }

    return files;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n  BioMonk — Sync Materials`);
    console.log(`  ─────────────────────────`);
    console.log(`  Bucket: ${BUCKET}\n`);

    // 1. List all files in bucket
    console.log("  Listing files in storage...");
    const allFiles = await listAllFiles();
    console.log(`  Found ${allFiles.length} PDF file(s) in bucket.\n`);

    if (allFiles.length === 0) {
        console.log("  Nothing to sync. Make sure you have uploaded PDFs to the bucket.");
        return;
    }

    // 2. Fetch existing file_paths from study_materials
    const { data: existing, error: fetchErr } = await supabase
        .from("study_materials")
        .select("file_path");

    if (fetchErr) {
        console.error("  Error reading study_materials table:", fetchErr.message);
        process.exit(1);
    }

    const existingPaths = new Set((existing || []).map((r: any) => r.file_path));

    // 3. Determine which files need inserting
    const toInsert = allFiles.filter(f => !existingPaths.has(f.path));

    console.log(`  Already in database : ${allFiles.length - toInsert.length}`);
    console.log(`  New files to insert : ${toInsert.length}\n`);

    if (toInsert.length === 0) {
        console.log("  All files are already synced.\n");
        return;
    }

    // 4. Insert missing rows
    const rows = toInsert.map(f => ({
        file_path: f.path,
        title: titleFromFilename(f.name),
        type: typeFromFilename(f.name),
        chapter_id: null,
        page_count: null,
        file_size_kb: f.size_bytes !== null ? Math.round(f.size_bytes / 1024) : 0,
    }));

    // Print what will be inserted
    console.log("  Inserting:");
    rows.forEach(r => {
        console.log(`    [${r.type.padEnd(14)}] ${r.title}`);
        console.log(`                   ${r.file_path}`);
    });
    console.log();

    const { data: inserted, error: insertErr } = await supabase
        .from("study_materials")
        .insert(rows)
        .select();

    if (insertErr) {
        console.error("  Insert error:", insertErr.message);
        process.exit(1);
    }

    // 5. Summary
    console.log("  ─────────────────────────────────────────");
    console.log(`  Files in bucket     : ${allFiles.length}`);
    console.log(`  Already in DB       : ${allFiles.length - toInsert.length}`);
    console.log(`  Newly inserted      : ${inserted?.length ?? 0}`);
    console.log(`\n  Done! Now set chapter_id for each row in:`);
    console.log(`  Supabase → Table Editor → study_materials\n`);
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
