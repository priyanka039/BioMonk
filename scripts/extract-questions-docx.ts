#!/usr/bin/env tsx
/**
 * BioMonk — Question Extractor (DOCX)
 * ==================================
 * Parses a DOCX of questions and inserts them into the `questions` table.
 *
 * Usage:
 *   npx tsx scripts/extract-questions-docx.ts --docx ./tests/dpp1.docx --test-id UUID
 *
 * Dry run (prints but does NOT insert):
 *   npx tsx scripts/extract-questions-docx.ts --docx ./tests/dpp1.docx --test-id UUID --dry-run
 *
 * DOCX text format expected (same as PDF extractor):
 *   Q1. Question text
 *   A) Option A
 *   B) Option B
 *   C) Option C
 *   D) Option D
 *   Answer: B
 *   Explanation: Optional explanation
 *
 * Env required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const docxPath = arg("--docx");
const testId = arg("--test-id");
const isDryRun = process.argv.includes("--dry-run");

if (!docxPath || !testId) {
  console.error(`
  Usage:
    npx tsx scripts/extract-questions-docx.ts --docx <path> --test-id <uuid> [--dry-run]
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

interface ParsedQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
}

interface ParseResult {
  parsed: ParsedQuestion;
  rawBlock: string;
}

interface FailedBlock {
  index: number;
  reason: string;
  rawBlock: string;
}

function splitIntoBlocks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/(?=^\s*(?:Q\s*)?\d+[\.\)]\s)/m);
  return blocks
    .map((b) => b.trim())
    .filter((b) => /^(?:Q\s*)?\d+[\.\)]/i.test(b));
}

function extractOption(block: string, letter: "A" | "B" | "C" | "D"): string {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:\\(${letter}\\)|${letter}[\\)\\.]|${letter}\\s)\\s*([\\s\\S]+?)` +
      `(?=\\n\\s*(?:\\([ABCD]\\)|[ABCD][\\)\\.]|[ABCD]\\s)|\\n\\s*(?:Answer|Ans|Correct)\\s*:|$)`,
    "im"
  );
  const m = block.match(pattern);
  if (!m) throw new Error(`Missing option ${letter}`);
  return m[1].replace(/\s+/g, " ").trim();
}

function parseBlock(block: string): ParsedQuestion {
  const afterNum = block.replace(/^\s*(?:Q\s*)?\d+[\.\)]\s*/i, "").trim();

  const qtMatch = afterNum.match(
    /([\s\S]+?)(?=\n\s*(?:\([ABCD]\)|[ABCD][\)\.]|[ABCD]\s))/im
  );
  if (!qtMatch) throw new Error("Could not find question text / option boundary");
  const question_text = qtMatch[1].replace(/\s+/g, " ").trim();

  const option_a = extractOption(block, "A");
  const option_b = extractOption(block, "B");
  const option_c = extractOption(block, "C");
  const option_d = extractOption(block, "D");

  const ansMatch = block.match(/(?:Answer|Ans|Correct)\s*:\s*([A-D])/im);
  if (!ansMatch) throw new Error("Missing answer line (Answer: X)");
  const correct_option = ansMatch[1].toUpperCase() as "A" | "B" | "C" | "D";

  const expMatch = block.match(
    /Explanation\s*:\s*([\s\S]+?)(?:\n\s*(?:Q\s*)?\d+[\.\)]|$)/im
  );
  const explanation = expMatch ? expMatch[1].replace(/\s+/g, " ").trim() : null;

  return {
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    explanation,
  };
}

function parseAllQuestions(text: string): {
  results: ParseResult[];
  failed: FailedBlock[];
} {
  const blocks = splitIntoBlocks(text);
  const results: ParseResult[] = [];
  const failed: FailedBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    try {
      const parsed = parseBlock(block);
      results.push({ parsed, rawBlock: block });
    } catch (err) {
      failed.push({ index: i + 1, reason: (err as Error).message, rawBlock: block });
    }
  }

  return { results, failed };
}

async function main() {
  console.log("\n  BioMonk — DOCX Question Extractor");
  console.log("  ──────────────────────────────────");
  console.log(`  DOCX  : ${docxPath}`);
  console.log(`  Test ID: ${testId}`);
  console.log(`  Mode  : ${isDryRun ? "DRY RUN (no DB changes)" : "LIVE INSERT"}\n`);

  const resolved = path.resolve(docxPath!);
  if (!fs.existsSync(resolved)) {
    console.error(`  File not found: ${resolved}`);
    process.exit(1);
  }

  if (!isDryRun) {
    const { data: test, error: testErr } = await supabase
      .from("tests")
      .select("id, title")
      .eq("id", testId)
      .single();

    if (testErr || !test) {
      console.error(`\n  Test not found for ID: ${testId}`);
      console.error("  Create the test first in Supabase → Table Editor → tests\n");
      process.exit(1);
    }
    console.log(`  Test  : "${(test as any).title}"\n`);
  }

  console.log("  Extracting text from DOCX...");
  const { value: rawText } = await mammoth.extractRawText({ path: resolved });
  const text = String(rawText || "");
  console.log(`  Characters extracted: ${text.length}\n`);

  console.log("  Parsing question blocks...");
  const { results, failed } = parseAllQuestions(text);
  console.log(`  Total blocks found : ${results.length + failed.length}`);
  console.log(`  Successfully parsed: ${results.length}`);
  console.log(`  Failed to parse    : ${failed.length}\n`);

  if (failed.length > 0) {
    console.log("  ───── Failed blocks (check DOCX formatting) ─────\n");
    for (const f of failed) {
      console.log(`  [Block ${f.index}] Reason: ${f.reason}`);
      console.log("  ─── Raw text ───");
      console.log(f.rawBlock.split("\n").map((l) => "  | " + l).join("\n"));
      console.log();
    }
  }

  if (results.length === 0) {
    console.error("  No questions could be parsed. Check your DOCX text format.\n");
    process.exit(1);
  }

  if (isDryRun) {
    console.log("  ═══ DRY RUN — Parsed Questions ═══\n");
    results.forEach((r, i) => {
      const q = r.parsed;
      console.log(`  Q${i + 1}. ${q.question_text}`);
      console.log(`   A) ${q.option_a}`);
      console.log(`   B) ${q.option_b}`);
      console.log(`   C) ${q.option_c}`);
      console.log(`   D) ${q.option_d}`);
      console.log(`   Answer: ${q.correct_option}${q.explanation ? "  — " + q.explanation : ""}`);
      console.log();
    });
    console.log("  ─── Dry run complete. No changes made to the database. ───\n");
    return;
  }

  console.log("  Clearing existing questions for this test...");
  const { error: delErr } = await supabase.from("questions").delete().eq("test_id", testId);
  if (delErr) {
    console.error("  Delete error:", delErr.message);
    process.exit(1);
  }

  console.log(`  Inserting ${results.length} questions...`);
  const rows = results.map((r, i) => ({
    test_id: testId,
    order_index: i + 1,
    question_text: r.parsed.question_text,
    option_a: r.parsed.option_a,
    option_b: r.parsed.option_b,
    option_c: r.parsed.option_c,
    option_d: r.parsed.option_d,
    correct_option: r.parsed.correct_option,
    explanation: r.parsed.explanation,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("questions")
    .insert(rows)
    .select();

  if (insErr) {
    console.error("  Insert error:", insErr.message);
    process.exit(1);
  }

  console.log("\n  ─────────────────────────────────────────");
  console.log(`  Inserted into DB    : ${inserted?.length ?? 0}`);
  console.log("\n  Next: Supabase → Table Editor → tests → set is_active = true\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

