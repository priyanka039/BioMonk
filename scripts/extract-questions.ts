#!/usr/bin/env tsx
/**
 * BioMonk — Question Extractor (thin CLI wrapper)
 * ===============================================
 * The parsing logic now lives in lib/parser.ts. This script only handles the
 * CLI: read the PDF from disk, run the shared parser, print a report, and
 * (unless --dry-run) write questions to the DB for a given test.
 *
 * Command:
 *   npx tsx scripts/extract-questions.ts --pdf ./dpps/Biology/evolution.pdf --test-id UUID --subject biology --file-path "dpps/Biology/10_Evolution.pdf"
 *
 * Dry run (no DB writes):
 *   npx tsx scripts/extract-questions.ts --pdf ./x.pdf --test-id UUID --dry-run
 *
 * Env required (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { parsePdf } from "../lib/parser";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function arg(flag: string): string | undefined {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
}

const pdfPath = arg("--pdf");
const testId = arg("--test-id");
const subject = arg("--subject");
const filePath = arg("--file-path");
const isDryRun = process.argv.includes("--dry-run");

if (!pdfPath || !testId) {
    console.error(`
  Usage:
    npx tsx scripts/extract-questions.ts --pdf <path> --test-id <uuid> --subject <biology|chemistry|physics> --file-path <bucket-path> [--dry-run]
`);
    process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error("\n  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local\n");
    process.exit(1);
}

const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    const subjectValue = (subject || "").toLowerCase().trim() || null;
    if (subjectValue && !["biology", "chemistry", "physics"].includes(subjectValue)) {
        console.error(`\n  Invalid --subject: "${subject}". Expected biology, chemistry, or physics.\n`);
        process.exit(1);
    }

    console.log("\n  BioMonk — Question Extractor");
    console.log("  ───────────────────────────────────");
    console.log(`  PDF      : ${pdfPath}`);
    console.log(`  Test ID  : ${testId}`);
    console.log(`  Subject  : ${subjectValue ?? "(not provided)"}`);
    console.log(`  Mode     : ${isDryRun ? "DRY RUN (no DB changes)" : "LIVE INSERT"}\n`);

    const resolved = path.resolve(pdfPath!);
    if (!fs.existsSync(resolved)) {
        console.error(`  File not found: ${resolved}`);
        process.exit(1);
    }
    const buf = fs.readFileSync(resolved);
    console.log(`  PDF size: ${(buf.length / 1024).toFixed(1)} KB`);
    console.log("  Parsing...\n");

    const { questions, report } = await parsePdf(buf);

    console.log("  ─── Extraction report ───");
    console.log(report.rawOutput.split("\n").map((l) => `  ${l}`).join("\n"));
    console.log();

    if (isDryRun) {
        questions.forEach((q, i) => {
            console.log(`  ${i + 1}. (Q${q.question_number}) ${q.question_text}`);
            console.log(`     A) ${q.option_a}`);
            console.log(`     B) ${q.option_b}`);
            console.log(`     C) ${q.option_c}`);
            console.log(`     D) ${q.option_d}`);
            console.log(`     Answer: ${q.correct_option}\n`);
        });
        console.log("  ─── Dry run complete. No changes made. ───\n");
        return;
    }

    const { data: test, error: testErr } = await supabase
        .from("tests")
        .select("id, title")
        .eq("id", testId)
        .single();
    if (testErr || !test) {
        console.error(`\n  Test not found for ID: ${testId}\n`);
        process.exit(1);
    }
    console.log(`  Test: "${(test as { title: string }).title}"\n`);

    console.log("  Clearing existing questions for this test...");
    const { error: delErr } = await supabase.from("questions").delete().eq("test_id", testId);
    if (delErr) {
        console.error("  Delete error:", delErr.message);
        process.exit(1);
    }

    console.log(`  Inserting ${questions.length} questions...`);
    const rows = questions.map((q, i) => ({
        test_id: testId,
        order_index: i + 1,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        explanation: null,
    }));

    const { data: inserted, error: insErr } = await supabase.from("questions").insert(rows).select();
    if (insErr) {
        console.error("  Insert error:", insErr.message);
        process.exit(1);
    }

    const updatePayload: Record<string, unknown> = {};
    if (subjectValue) updatePayload.subject = subjectValue;
    if (typeof filePath === "string" && filePath.trim().length > 0) {
        updatePayload.original_file_path = filePath.trim();
    }
    if (Object.keys(updatePayload).length > 0) {
        const { error: updErr } = await supabase.from("tests").update(updatePayload).eq("id", testId);
        if (updErr) console.error("  Warning: could not update tests row:", updErr.message);
    }

    console.log(`\n  Done. Inserted ${inserted?.length ?? 0} questions.\n`);
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
