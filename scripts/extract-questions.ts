#!/usr/bin/env tsx
/**
 * BioMonk — Question Extractor (DPP PDF format)
 * ============================================
 *
 * This parser is designed for PDFs where:
 * - Questions start with "1." or "1)" at the start of a line.
 * - Options are numbered "1) 2) 3) 4)" on separate lines.
 * - Answers are NOT inline. Instead, there is an "Answer Key" section at the end
 *   of the PDF containing a grid of question-answer pairs, e.g.:
 *
 *   Answer Key
 *   1    2    16    4    31    1
 *   2    4    17    3    32    4
 *
 *   The grid alternates between question number and answer value (1–4),
 *   and may have 2/3/… columns side-by-side depending on PDF layout.
 *
 * Command:
 *   npx tsx scripts/extract-questions.ts --pdf ./dpps/Biology/evolution.pdf --test-id UUID --subject biology --file-path "dpps/Biology/10_Evolution.pdf"
 *
 * Dry run:
 *   npx tsx scripts/extract-questions.ts --pdf ./dpps/Biology/evolution.pdf --test-id UUID --subject biology --file-path "dpps/Biology/10_Evolution.pdf" --dry-run
 *
 * Env required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

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

  Example:
    npx tsx scripts/extract-questions.ts --pdf ./dpps/Biology/evolution.pdf --test-id abc123 --subject biology --file-path "dpps/Biology/10_Evolution.pdf"
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

type Subject = "biology" | "chemistry" | "physics";

interface ParsedQuestion {
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D" | null;
}

function normalizeText(s: string) {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function compactSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function toLetter(n: number): "A" | "B" | "C" | "D" {
  if (n === 1) return "A";
  if (n === 2) return "B";
  if (n === 3) return "C";
  return "D";
}

type AnswerKeyMode = "inline_answer_key" | "dpp_pairs" | "chapter_table" | "parentheses_pairs" | "plain_pairs" | "table_format";

function tokenizeNumericLine(line: string): number[] {
  const tokens = line
    .trim()
    // keep only digits and spaces for robust tokenization
    .replace(/[^\d\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n));
  return tokens;
}

function isAllAnswersRow(nums: number[]): boolean {
  return nums.length > 0 && nums.every((n) => n >= 1 && n <= 4);
}

function isLikelyQuestionRow(nums: number[]): boolean {
  if (nums.length === 0) return false;
  // Question rows typically contain numbers > 4, and no zeros/negatives
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  return min >= 1 && max > 4;
}

// Header spelling varies in the source PDFs (e.g. "Answer Key" vs "Anwer Key").
// This regex matches both:
// - "Answer Key"
// - "Anwer Key" (missing the "s" after "n")
const answerKeyHeaderRe = /a\s*n\s*s?\s*w\s*e\s*r\s*key/i;

function parseAnswerKey(fullText: string): {
  answerMap: Map<number, number>;
  answerKeyText: string | null;
  mode: AnswerKeyMode | null;
} {
  // ── Step 0 — Inline Answer Key format ("Answer key : c" after each question) ──
  const inlineAnswerKeyRe = /Answer\s*key\s*:\s*[abcd]/gi;
  const inlineMatches = fullText.match(inlineAnswerKeyRe);
  if (inlineMatches && inlineMatches.length >= 5) {
    return { answerMap: new Map<number, number>(), answerKeyText: fullText, mode: "inline_answer_key" };
  }

  const headerMatch = answerKeyHeaderRe.exec(fullText);
  const headerIdx = headerMatch && headerMatch.index !== undefined ? headerMatch.index : -1;

  const answerKeyText = headerIdx >= 0 ? fullText.slice(headerIdx) : null;
  const scanText = answerKeyText ?? fullText;

  // ── Step 1 — Table format (Question/Type/Option/Answer blocks) ────────────
  // Detect if we can parse 5+ well-formed blocks.
  const { questions: tableQuestions } = parseTableFormatQuestions(scanText);
  if (tableQuestions.length >= 5) {
    return { answerMap: new Map<number, number>(), answerKeyText: scanText, mode: "table_format" };
  }

  // For the remaining formats, we require an explicit answer-key section.
  if (!answerKeyText) {
    return { answerMap: new Map<number, number>(), answerKeyText: null, mode: null };
  }

  const answerMap = new Map<number, number>();

  // ── Step 2 — Parentheses format: "(number)   digit" ───────────────────────
  // We only switch to this mode when we see at least 3 such pairs.
  const parenRe = /\((\d+)\)\s+([1-4])\b/gm;
  let parenMatch: RegExpExecArray | null;
  let parenPairsFound = 0;

  while ((parenMatch = parenRe.exec(answerKeyText))) {
    const q = Number(parenMatch[1]);
    const a = Number(parenMatch[2]);
    if (!Number.isFinite(q) || !Number.isFinite(a)) continue;
    parenPairsFound++;
    answerMap.set(q, a);
  }

  if (parenPairsFound >= 3) {
    return { answerMap, answerKeyText, mode: "parentheses_pairs" };
  }

  answerMap.clear();

  // ── Step 3 — Plain pairs: "1   2" (one pair per line) ─────────────────────
  // Detect at least 5 lines like: /^\s*(\d{1,2})\s+([1-4])\s*$/
  const plainPairRe = /^\s*(\d{1,2})\s+([1-4])\s*$/;
  const answerLines = normalizeText(answerKeyText).split("\n").map((l) => l.trim());
  let plainPairsFound = 0;

  for (const l of answerLines) {
    const m = l.match(plainPairRe);
    if (!m) continue;
    const q = Number(m[1]);
    const a = Number(m[2]);
    if (!Number.isFinite(q) || !Number.isFinite(a)) continue;
    plainPairsFound++;
    answerMap.set(q, a);
  }

  if (plainPairsFound >= 5) {
    return { answerMap, answerKeyText, mode: "plain_pairs" };
  }

  // ── Step 4 — Try chapter-test "two-row table" answer key ──────────────────
  // Pattern:
  //   <q1 q2 q3 ...>
  //   <a1 a2 a3 ...>   (answers are 1..4)
  const lines = normalizeText(answerKeyText)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (let i = 0; i < lines.length - 1; i++) {
    const qNums = tokenizeNumericLine(lines[i]);
    const aNums = tokenizeNumericLine(lines[i + 1]);

    if (!isLikelyQuestionRow(qNums) || !isAllAnswersRow(aNums)) continue;
    if (qNums.length !== aNums.length) continue;

    // Found at least one valid table block; parse consecutive blocks
    for (let j = i; j < lines.length - 1; j++) {
      const qs = tokenizeNumericLine(lines[j]);
      const as = tokenizeNumericLine(lines[j + 1]);
      if (!isLikelyQuestionRow(qs) || !isAllAnswersRow(as) || qs.length !== as.length) break;

      for (let k = 0; k < qs.length; k++) {
        const q = qs[k];
        const a = as[k];
        if (q && a) answerMap.set(q, a);
      }
      j++; // advance by 2 lines
      i = j; // keep outer loop in sync
    }

    return { answerMap, answerKeyText, mode: "chapter_table" };
  }

  // ── Step 5 — Fallback: alternating pairs ───────────────────────────────────
  // Match pairs anywhere in the grid: "<questionNumber> <answerNumber>"
  // Some PDFs render as "1) 2" (with the ")" attached) so we allow an optional "." or ")"
  const re = /(\d{1,5})\s*[\.\)]?\s+([1-4])\b/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(answerKeyText))) {
    const qNum = Number(match[1]);
    const ans = Number(match[2]);
    if (Number.isFinite(qNum) && Number.isFinite(ans)) {
      answerMap.set(qNum, ans);
    }
  }

  return { answerMap, answerKeyText, mode: "dpp_pairs" };
}

function parseTableFormatQuestions(text: string): {
  questions: ParsedQuestion[];
  failedBlocks: { question_number: number; reason: string }[];
} {
  const placeholder = "Option text not extracted (likely in a table). Refer to the original PDF.";
  const lines = normalizeText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const questions: ParsedQuestion[] = [];
  const failedBlocks: { question_number: number; reason: string }[] = [];

  let i = 0;
  let qCounter = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!/^Question\b/i.test(line)) {
      i++;
      continue;
    }

    const qText = line.replace(/^Question\s*/i, "").trim();
    i++;

    // Skip optional Type line.
    if (i < lines.length && /^Type\b/i.test(lines[i])) i++;

    const optVals: string[] = [];
    while (i < lines.length && /^Option\b/i.test(lines[i]) && optVals.length < 4) {
      const rest = lines[i].replace(/^Option\s*/i, "").trim();
      optVals.push(rest);
      i++;
    }

    // Advance until we hit Answer (or next Question).
    while (i < lines.length && !/^Answer\b/i.test(lines[i]) && !/^Question\b/i.test(lines[i])) {
      i++;
    }

    let ansDigit: number | null = null;
    if (i < lines.length && /^Answer\b/i.test(lines[i])) {
      const ansStr = lines[i].replace(/^Answer\s*/i, "").trim();
      const m = ansStr.match(/([1-4])\b/);
      ansDigit = m ? Number(m[1]) : null;
      i++;
    }

    if (ansDigit === null || ansDigit < 1 || ansDigit > 4) {
      continue;
    }

    qCounter++;
    const option_a = optVals[0] && optVals[0].length > 0 ? optVals[0] : placeholder;
    const option_b = optVals[1] && optVals[1].length > 0 ? optVals[1] : placeholder;
    const option_c = optVals[2] && optVals[2].length > 0 ? optVals[2] : placeholder;
    const option_d = optVals[3] && optVals[3].length > 0 ? optVals[3] : placeholder;

    questions.push({
      question_number: qCounter,
      question_text: qText || "Refer to the question text in the original table.",
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option: toLetter(ansDigit),
    });
  }

  return { questions, failedBlocks };
}

function parseQuestions(questionSection: string): {
  questions: ParsedQuestion[];
  questionNumbersFound: number[];
  failedBlocks: { question_number: number; reason: string }[];
} {
  const lines = normalizeText(questionSection)
    .split("\n")
    .map((l) => l.replace(/\t/g, " ").trim())
    .filter((l) => l.length > 0);

  const questions: ParsedQuestion[] = [];
  const failedBlocks: { question_number: number; reason: string }[] = [];
  const questionNumbersFound: number[] = [];

  const qStartRe = /^(\d{1,5})\s*[\.\)]\s*(.*)?$/;
  // Options appear as "1) ..." (DPP) or "(1) ..." (chapter tests).
  // IMPORTANT: do NOT treat "1. ..." as an option, because many PDFs contain nested numbered
  // statements inside the question text (e.g. "1. Fill in the blanks...").
  const optReDpp = /^([1-4])\s*\)\s*(.*)$/;
  const optReChapter = /^\(\s*([1-4])\s*\)\s*(.*)$/;

  let current: {
    qNum: number;
    qLines: string[];
    optLines: Record<1 | 2 | 3 | 4, string[]>;
    activeOpt: 1 | 2 | 3 | 4 | null;
    blockLines: string[];
    sawOptionMarker: Record<1 | 2 | 3 | 4, boolean>;
  } | null = null;

  function hasSeenAllFourOptions(c: NonNullable<typeof current>): boolean {
    return c.sawOptionMarker[1] && c.sawOptionMarker[2] && c.sawOptionMarker[3] && c.sawOptionMarker[4];
  }

  /** Only treat as non-content when the PDF clearly glued multiple markers with no real text. */
  function isJustOptionMarker(s: string): boolean {
    const t = compactSpaces(s);
    if (!t.length) return false;
    // Runs like "(2) (3) (4)" or "2) 3) 4)" with nothing else — not a real answer choice.
    if (/^(?:\(\s*[1-4]\s*\)|[1-4]\s*\))(?:\s+(?:\(\s*[1-4]\s*\)|[1-4]\s*\)))+$/.test(t)) return true;
    // Short single-digit / bare-marker answers (e.g. "1", "F", "(2)") are valid; do not strip.
    return false;
  }

  function extractOptionsFallback(blockText: string): Partial<Record<1 | 2 | 3 | 4, string>> {
    // Try to recover options even when PDF extraction drops line breaks or splits across pages.
    // We look for markers (1)/(2)/(3)/(4) or 1)/2)/3)/4) and take text until next marker.
    const s = normalizeText(blockText);
    const out: Partial<Record<1 | 2 | 3 | 4, string>> = {};

    // Do not include "1." style markers here for the same reason as above.
    const markerRe = /(?:^|\n|\s)(?:\(\s*([1-4])\s*\)|([1-4])\s*\))\s*/g;
    const hits: { n: 1 | 2 | 3 | 4; i: number; len: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = markerRe.exec(s))) {
      const raw = (m[1] || m[2] || m[3]) ?? "";
      const n = Number(raw) as 1 | 2 | 3 | 4;
      if (n >= 1 && n <= 4) hits.push({ n, i: m.index, len: m[0].length });
    }
    if (hits.length === 0) return out;

    for (let idx = 0; idx < hits.length; idx++) {
      const cur = hits[idx];
      const next = hits[idx + 1];
      const start = cur.i + cur.len;
      const end = next ? next.i : s.length;
      const chunk = compactSpaces(s.slice(start, end));
      if (chunk) out[cur.n] = chunk;
    }

    return out;
  }

  function flushCurrent() {
    if (!current) return;
    const question_number = current.qNum;
    let question_text = compactSpaces(current.qLines.join(" "));

    let option_a = compactSpaces(current.optLines[1].join(" "));
    let option_b = compactSpaces(current.optLines[2].join(" "));
    let option_c = compactSpaces(current.optLines[3].join(" "));
    let option_d = compactSpaces(current.optLines[4].join(" "));

    if (isJustOptionMarker(option_a)) option_a = "";
    if (isJustOptionMarker(option_b)) option_b = "";
    if (isJustOptionMarker(option_c)) option_c = "";
    if (isJustOptionMarker(option_d)) option_d = "";

    // Fallback: if some options are missing or empty, try to re-extract from the whole block.
    if (!option_a || !option_b || !option_c || !option_d) {
      const recovered = extractOptionsFallback(current.blockLines.join("\n"));
      if (!option_a && recovered[1]) option_a = recovered[1];
      if (!option_b && recovered[2]) option_b = recovered[2];
      if (!option_c && recovered[3]) option_c = recovered[3];
      if (!option_d && recovered[4]) option_d = recovered[4];
    }

    // If question text is missing (common when the question is an image), keep the block insertable.
    if (!question_text) {
      failedBlocks.push({ question_number, reason: "Question text missing in PDF extract; inserted placeholder" });
      question_text = "Refer to the figure/diagram in the original PDF.";
    }

    // If options are still missing/empty, insert safe placeholders (diagram/table options are often images).
    const placeholder = "Option text not extracted (likely in a figure/table). Refer to the original PDF.";
    const missing: string[] = [];
    if (!option_a) {
      option_a = placeholder;
      missing.push("1");
    }
    if (!option_b) {
      option_b = placeholder;
      missing.push("2");
    }
    if (!option_c) {
      option_c = placeholder;
      missing.push("3");
    }
    if (!option_d) {
      option_d = placeholder;
      missing.push("4");
    }
    if (missing.length > 0) {
      failedBlocks.push({
        question_number,
        reason: `Option text missing for (${missing.join(",")}); inserted placeholders`,
      });
    }

    questions.push({
      question_number,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option: null, // filled after answer key mapping
    });

    current = null;
  }

  for (const line of lines) {
    // Stop if answer key header appears in this section (some PDFs repeat it)
    if (/answer\s*key/i.test(line)) break;

    // If we're inside a question, options must take priority over question-start parsing,
    // because options are also "1) .. 4)" and would otherwise be misclassified as new questions.
    if (current) {
      const optChapter = line.match(optReChapter);
      const optDpp = optChapter ? null : line.match(optReDpp);
      const opt = optChapter || optDpp;
      if (opt) {
        const optNum = Number(opt[1]) as 1 | 2 | 3 | 4;
        current.blockLines.push(line);
        current.activeOpt = optNum;
        current.sawOptionMarker[optNum] = true;
        let rest = (opt[2] || "").trim();
        // Sometimes the extracted "rest" is actually just the next marker(s), like "(2) (3) (4)".
        // Treat that as missing so the diagram/table placeholder logic kicks in.
        if (isJustOptionMarker(rest)) rest = "";
        current.optLines[optNum].push(rest);
        continue;
      }

      // Multi-line options: wrapped formulas continue until the next 1)–4) line or the next question.
      // If we have not yet seen all four option markers, a line matching qStartRe may be garbled math
      // (e.g. "2." or "3)") — keep it on the active option. After all four markers exist, qStartRe with
      // n > current.qNum starts the next question (handled below).
      if (current.activeOpt) {
        const optAgainChapter = line.match(optReChapter);
        const optAgainDpp = optAgainChapter ? null : line.match(optReDpp);
        if (!optAgainChapter && !optAgainDpp) {
          const qsMaybe = line.match(qStartRe);
          if (qsMaybe) {
            const n = Number(qsMaybe[1]);
            const allFour = hasSeenAllFourOptions(current);
            if (!allFour || n <= current.qNum) {
              current.blockLines.push(line);
              current.optLines[current.activeOpt].push(line);
              continue;
            }
            // allFour && n > current.qNum — fall through to flush + new question
          } else {
            current.blockLines.push(line);
            current.optLines[current.activeOpt].push(line);
            continue;
          }
        }
      }
    }

    const qs = line.match(qStartRe);
    if (qs) {
      flushCurrent();
      const qNum = Number(qs[1]);
      if (!Number.isFinite(qNum)) continue;
      questionNumbersFound.push(qNum);
      current = {
        qNum,
        qLines: [],
        optLines: { 1: [], 2: [], 3: [], 4: [] },
        activeOpt: null,
        blockLines: [line],
        sawOptionMarker: { 1: false, 2: false, 3: false, 4: false },
      };
      const inline = (qs[2] || "").trim();
      if (inline) current.qLines.push(inline);
      continue;
    }

    if (!current) continue;

    // Continuation line
    current.blockLines.push(line);
    if (current.activeOpt) {
      current.optLines[current.activeOpt].push(line);
    } else {
      current.qLines.push(line);
    }
  }

  flushCurrent();

  return { questions, questionNumbersFound, failedBlocks };
}

function parseInlineOptionAnswerQuestions(fullText: string): {
  questions: ParsedQuestion[];
  failedBlocks: { question_number: number; reason: string }[];
} {
  // Some of your DPP PDFs use this layout:
  // - "Question ..."
  // - "Type multiple choice"
  // - "Option ..." repeated for 4 choices
  // - "Answer 1" (or 2/3/4)
  // - then "Solution", "Positive Marks", etc.
  const lines = normalizeText(fullText)
    .split("\n")
    .map((l) => l.replace(/\t/g, " ").trim())
    .filter((l) => l.length > 0);

  const questions: ParsedQuestion[] = [];
  const failedBlocks: { question_number: number; reason: string }[] = [];

  const placeholder = "Option text not extracted (likely in a figure/table). Refer to the original PDF.";

  type InlineCurrent = {
    qNum: number;
    qLines: string[];
    optLines: Record<1 | 2 | 3 | 4, string[]>;
    activeOpt: 1 | 2 | 3 | 4 | null;
    correctAns: 1 | 2 | 3 | 4 | null;
    afterAnswer: boolean;
    optionSeenCount: number;
  };

  let current: InlineCurrent | null = null;

  function flushCurrent() {
    if (!current) return;
    const question_text = compactSpaces(current.qLines.join(" "));

    let option_a = compactSpaces(current.optLines[1].join(" "));
    let option_b = compactSpaces(current.optLines[2].join(" "));
    let option_c = compactSpaces(current.optLines[3].join(" "));
    let option_d = compactSpaces(current.optLines[4].join(" "));

    if (!question_text) {
      failedBlocks.push({ question_number: current.qNum, reason: "Question text missing" });
    }

    if (!option_a) option_a = placeholder;
    if (!option_b) option_b = placeholder;
    if (!option_c) option_c = placeholder;
    if (!option_d) option_d = placeholder;

    const correct_option = current.correctAns ? toLetter(current.correctAns) : null;
    if (!correct_option) {
      failedBlocks.push({ question_number: current.qNum, reason: "Missing inline answer" });
      current = null;
      return;
    }

    questions.push({
      question_number: current.qNum,
      question_text: question_text || "Refer to the figure/diagram in the original PDF.",
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
    });
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^question\b/i.test(line)) {
      flushCurrent();

      const qText = line.replace(/^question\s*/i, "").replace(/\-+$/g, "").trim();
      current = {
        qNum: questions.length + failedBlocks.length + 1,
        qLines: qText ? [qText] : [],
        optLines: { 1: [], 2: [], 3: [], 4: [] },
        activeOpt: null,
        correctAns: null,
        afterAnswer: false,
        optionSeenCount: 0,
      };
      continue;
    }

    if (!current) continue;

    // Ignore common non-question markers.
    if (/^type\b/i.test(line)) continue;
    if (/^solution\b/i.test(line)) {
      current.afterAnswer = current.correctAns !== null;
      continue;
    }
    if (/^(positive marks|negative marks)\b/i.test(line)) {
      current.afterAnswer = current.correctAns !== null;
      continue;
    }

    // Inline answer line.
    const ansMatch = line.match(/^answer\s*[:\-]?\s*([1-4])\b/i);
    if (ansMatch) {
      current.correctAns = Number(ansMatch[1]) as 1 | 2 | 3 | 4;
      current.afterAnswer = true;
      current.activeOpt = null;
      continue;
    }

    // Option lines (sequentially map to A/B/C/D).
    const optMatch = line.match(/^option\b/i);
    if (optMatch) {
      current.optionSeenCount++;
      const optNum = current.optionSeenCount as 1 | 2 | 3 | 4;
      if (optNum >= 1 && optNum <= 4) {
        current.activeOpt = optNum;
        const rest = line.replace(/^option\s*/i, "").trim();
        if (rest) current.optLines[optNum].push(rest);
      } else {
        current.activeOpt = null;
      }
      continue;
    }

    // Continuation lines.
    if (current.afterAnswer) continue;
    if (current.activeOpt) current.optLines[current.activeOpt].push(line);
    else current.qLines.push(line);
  }

  flushCurrent();

  return { questions, failedBlocks };
}

// ─── Inline Answer Key Parser (interleaved per-page layout) ──────────────────
// The PDF text interleaves structural marker lines with actual content per page:
//   Marker lines: "N."  "(a)\t(b)"  "(c)\t(d)"  "Answer key : X"  "Correct/Wrong Marks : ..."
//   Content lines: actual question text + option values (appear after the markers on each page)
//
// Strategy — single pass over all lines:
//   • If line matches "Answer key : [abcd]"  → push to answers array
//   • If line is a structural marker          → skip
//   • Otherwise                              → it's a content line (question text or option value)
// Then group content lines into (1 question text + 4 option values) blocks, zip with answers.
function parseInlineAnswerKeyQuestions(fullText: string): {
  questions: ParsedQuestion[];
  failedBlocks: { question_number: number; reason: string }[];
} {
  const questions: ParsedQuestion[] = [];
  const failedBlocks: { question_number: number; reason: string }[] = [];

  const normalized = normalizeText(fullText);
  const allLines = normalized.split("\n");

  const answers: ("A" | "B" | "C" | "D")[] = [];
  const contentLines: string[] = [];

  for (const rawLine of allLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ── Structural marker lines → skip (but collect answers) ──────────────────
    // "Answer key : c"
    const ansMatch = line.match(/^Answer\s*key\s*:\s*([abcd])\s*$/i);
    if (ansMatch) {
      answers.push(ansMatch[1].toUpperCase() as "A" | "B" | "C" | "D");
      continue;
    }
    // "N."  (question number marker — just a digit+period alone on the line)
    if (/^\d+\.\s*$/.test(line)) continue;
    // "(a)  (b)"  or  "(a)" — option letter markers (possibly with tab, no real text)
    if (/^\(([abcd])\)(\s*\t\s*\(([abcd])\))?\s*$/i.test(line)) continue;
    // "(a)   (b)" — tab-separated pair of option letters only
    if (/^\([abcd]\)\s+\([abcd]\)\s*$/i.test(line)) continue;
    // "Correct Marks : ..."  /  "Wrong Marks : ..."
    if (/^(Correct|Wrong)\s*Marks\s*:/i.test(line)) continue;
    // Page header/footer: "-- N of 18 --"
    if (/^--\s*\d+\s*of\s*\d+\s*--/.test(line)) continue;
    // Section header: "Section: Biology" / "Biology Class XI ..."
    if (/^(Section\s*:|Biology Class|Instructions|Sections:)/i.test(line)) continue;

    // Everything else is a content line (question text or option value)
    contentLines.push(line);
  }

  if (answers.length === 0) {
    return { questions, failedBlocks };
  }

  // ── Split a content line into 1 or 2 option values ────────────────────────
  // A tab or 3+ spaces in the middle indicates a side-by-side option pair.
  // e.g.  "Class\torder"  →  ["Class", "order"]
  // e.g.  "Mutual exclusive events"  →  ["Mutual exclusive events"]
  function splitOptLine(line: string): string[] {
    const parts = line.split(/\t|\s{3,}/).map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2 ? parts.slice(0, 2) : [line];
  }

  // ── State machine: (1 question text line) + (option lines until 4 values) ──
  type QBlock = { qText: string; opts: string[] };
  const blocks: QBlock[] = [];

  let state: "expecting_question" | "collecting_options" = "expecting_question";
  let currentQText = "";
  let currentOpts: string[] = [];

  for (const line of contentLines) {
    if (state === "expecting_question") {
      currentQText = line;
      currentOpts = [];
      state = "collecting_options";
    } else {
      const parts = splitOptLine(line);
      for (const p of parts) currentOpts.push(p);

      if (currentOpts.length >= 4) {
        blocks.push({ qText: currentQText, opts: currentOpts.slice(0, 4) });
        currentQText = "";
        currentOpts = [];
        state = "expecting_question";
      }
    }
  }

  // Flush any remaining partial block
  if (state === "collecting_options" && currentQText) {
    while (currentOpts.length < 4) currentOpts.push("");
    blocks.push({ qText: currentQText, opts: currentOpts.slice(0, 4) });
  }

  // ── Zip answers ↔ blocks by index ─────────────────────────────────────────
  const numQ = Math.min(answers.length, blocks.length);
  const placeholder = "Option text not extracted (likely in a figure/table). Refer to the original PDF.";

  for (let i = 0; i < numQ; i++) {
    const qNum = i + 1;
    const correct_option = answers[i];
    const { qText, opts } = blocks[i];

    const question_text = compactSpaces(qText) || "Refer to the figure/diagram in the original PDF.";
    const option_a = compactSpaces(opts[0]) || placeholder;
    const option_b = compactSpaces(opts[1]) || placeholder;
    const option_c = compactSpaces(opts[2]) || placeholder;
    const option_d = compactSpaces(opts[3]) || placeholder;

    const missing: string[] = [];
    if (option_a === placeholder) missing.push("a");
    if (option_b === placeholder) missing.push("b");
    if (option_c === placeholder) missing.push("c");
    if (option_d === placeholder) missing.push("d");

    if (missing.length > 0) {
      failedBlocks.push({
        question_number: qNum,
        reason: `Option text missing for (${missing.join(",")}); inserted placeholders`,
      });
    }

    questions.push({
      question_number: qNum,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
    });
  }

  if (answers.length !== blocks.length) {
    console.warn(
      `  ⚠ Answer count (${answers.length}) ≠ content blocks (${blocks.length}). ` +
        `Only ${numQ} questions will be inserted.`
    );
  }

  return { questions, failedBlocks };
}



// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const subjectNormalized = (subject || "").toLowerCase().trim();
  const subjectValue = (subjectNormalized || null) as Subject | null;

  if (subjectValue && !["biology", "chemistry", "physics"].includes(subjectValue)) {
    console.error(`\n  Invalid --subject: "${subject}". Expected biology, chemistry, or physics.\n`);
    process.exit(1);
  }

  console.log("\n  BioMonk — Question Extractor (DPP)");
  console.log("  ───────────────────────────────────");
  console.log(`  PDF      : ${pdfPath}`);
  console.log(`  Test ID  : ${testId}`);
  console.log(`  Subject  : ${subjectValue ?? "(not provided)"}`);
  console.log(`  File path: ${filePath ?? "(not provided)"}`);
  console.log(`  Mode     : ${isDryRun ? "DRY RUN (no DB changes)" : "LIVE INSERT"}\n`);

  // ── Verify PDF ──────────────────────────────────────────────────────────────
  const resolved = path.resolve(pdfPath!);
  if (!fs.existsSync(resolved)) {
    console.error(`  File not found: ${resolved}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(resolved);
  console.log(`  PDF size: ${(buf.length / 1024).toFixed(1)} KB`);

  // ── Extract text ────────────────────────────────────────────────────────────
  console.log("  Extracting text from PDF...");
  const pdfMod: any = (pdfParse as any);

  let extractedText = "";
  // Newer pdf-parse versions export a PDFParse class.
  if (typeof pdfMod?.PDFParse === "function") {
    const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const parser = new pdfMod.PDFParse(uint8);
    const out = await parser.getText();
    extractedText =
      typeof out === "string"
        ? out
        : typeof out === "object" && out && typeof (out as any).text === "string"
          ? (out as any).text
          : String(out ?? "");
    await parser.destroy?.();
  } else {
    // Older pdf-parse versions export a callable function.
    const pdfParseFn: any = pdfMod?.default ?? pdfMod;
    if (typeof pdfParseFn !== "function") {
      throw new Error("Unsupported pdf-parse export shape. Expected PDFParse class or callable function.");
    }
    const pdfData = await pdfParseFn(buf);
    extractedText = pdfData?.text || "";
  }

  const fullText = normalizeText(extractedText || "");
  console.log(`  Characters extracted: ${fullText.length}\n`);

  // ── Answer key ──────────────────────────────────────────────────────────────
  const { answerMap, answerKeyText, mode: answerKeyMode } = parseAnswerKey(fullText);

  let questions: ParsedQuestion[] = [];
  let failedBlocks: { question_number: number; reason: string }[] = [];
  let matched: ParsedQuestion[] = [];
  let unmatchedQuestionNumbers: number[] = [];
  let totalQuestionBlocksFound = 0;

  if (answerKeyMode === "inline_answer_key") {
    console.log(`  Answer key mode            : ${answerKeyMode}\n`);
    console.log("  Parsing inline-answer-key question blocks...");
    ({ questions, failedBlocks } = parseInlineAnswerKeyQuestions(fullText));
    totalQuestionBlocksFound = questions.length + failedBlocks.length;
    matched = questions; // answers already embedded

    console.log(`  Total question blocks found: ${totalQuestionBlocksFound}`);
    console.log(`  Parsed question blocks     : ${questions.length}`);
    console.log(`  Failed question blocks     : ${failedBlocks.length}`);
    console.log(`  Answer key entries found   : (inline)\n`);
  } else if (answerKeyText && answerKeyMode === "table_format") {
    console.log(`  Answer key mode            : ${answerKeyMode ?? "unknown"}\n`);
    console.log("  Parsing table-format question blocks...");
    ({ questions, failedBlocks } = parseTableFormatQuestions(answerKeyText));
    totalQuestionBlocksFound = questions.length + failedBlocks.length;
    matched = questions;

    console.log(`  Total question blocks found: ${totalQuestionBlocksFound}`);
    console.log(`  Parsed question blocks     : ${questions.length}`);
    console.log(`  Failed question blocks     : ${failedBlocks.length}`);
    console.log(`  Answer key entries found   : ${answerMap.size}\n`);
  } else if (answerKeyText) {
    // Parse questions from everything before answer key section.
    const headerIdx = fullText.search(answerKeyHeaderRe);
    const questionSection = headerIdx >= 0 ? fullText.slice(0, headerIdx) : fullText;

    console.log("  Parsing questions...");
    ({ questions, failedBlocks } = parseQuestions(questionSection));

    totalQuestionBlocksFound = questions.length + failedBlocks.length;
    console.log(`  Total question blocks found: ${totalQuestionBlocksFound}`);
    console.log(`  Parsed question blocks     : ${questions.length}`);
    console.log(`  Failed question blocks     : ${failedBlocks.length}`);
    console.log(`  Answer key entries found   : ${answerMap.size}`);
    console.log(`  Answer key mode            : ${answerKeyMode ?? "unknown"}\n`);

    // ── Match questions to answer key ───────────────────────────────────────────
    matched = [];
    for (const q of questions) {
      const ans = answerMap.get(q.question_number);
      if (!ans) {
        unmatchedQuestionNumbers.push(q.question_number);
        continue;
      }
      q.correct_option = toLetter(ans);
      matched.push(q);
    }
  } else {
    console.log("\n  Could not find an 'Answer Key' section in the PDF.");
    console.log("  Attempting inline 'Question/Option/Answer' parsing...\n");

    ({ questions, failedBlocks } = parseInlineOptionAnswerQuestions(fullText));
    matched = questions; // inline parser already sets correct_option
    totalQuestionBlocksFound = questions.length + failedBlocks.length;

    console.log(`  Total question blocks found: ${totalQuestionBlocksFound}`);
    console.log(`  Parsed question blocks     : ${questions.length}`);
    console.log(`  Failed question blocks     : ${failedBlocks.length}`);
    console.log(`  Answer key entries found   : 0`);
    console.log(`  Answer key mode            : inline_answer\n`);
  }

  // ── Dry run ────────────────────────────────────────────────────────────────
  if (isDryRun) {
    console.log("  ═══ DRY RUN — Parsed Questions (matched only) ═══\n");
    matched.forEach((q, i) => {
      console.log(`  ${i + 1}. (Q${q.question_number}) ${q.question_text}`);
      console.log(`     A) ${q.option_a}`);
      console.log(`     B) ${q.option_b}`);
      console.log(`     C) ${q.option_c}`);
      console.log(`     D) ${q.option_d}`);
      console.log(`     Answer: ${q.correct_option}`);
      console.log();
    });

    console.log("  ─────────────────────────────────────────");
    console.log(`  Total question blocks found : ${totalQuestionBlocksFound}`);
    console.log(`  Answer key entries found    : ${answerMap.size}`);
    console.log(`  Successfully matched        : ${matched.length}`);
    console.log(
      `  Failed blocks              : ${
        failedBlocks.length > 0 ? failedBlocks.map((f) => `${f.question_number}(${f.reason})`).join(", ") : "None"
      }`
    );
    console.log(
      `  Missing answers for        : ${
        unmatchedQuestionNumbers.length > 0 ? unmatchedQuestionNumbers.join(", ") : "None"
      }`
    );
    console.log("  Total inserted             : 0");
    console.log("\n  ─── Dry run complete. No changes made to the database. ───\n");
    return;
  }

  // ── Verify test exists ──────────────────────────────────────────────────────
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
  console.log(`  Test: "${(test as any).title}"\n`);

  // ── Delete existing questions ───────────────────────────────────────────────
  console.log("  Clearing existing questions for this test...");
  const { error: delErr } = await supabase.from("questions").delete().eq("test_id", testId);
  if (delErr) {
    console.error("  Delete error:", delErr.message);
    process.exit(1);
  }

  // ── Insert matched questions ────────────────────────────────────────────────
  console.log(`  Inserting ${matched.length} questions...`);
  const rows = matched.map((q, i) => ({
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

  // ── Update tests row with subject/original_file_path ────────────────────────
  const updatePayload: Record<string, any> = {};
  if (subjectValue) updatePayload.subject = subjectValue;
  if (typeof filePath === "string" && filePath.trim().length > 0) updatePayload.original_file_path = filePath.trim();

  if (Object.keys(updatePayload).length > 0) {
    const { error: updErr } = await supabase.from("tests").update(updatePayload).eq("id", testId);
    if (updErr) {
      console.error("  Warning: could not update tests row:", updErr.message);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n  ─────────────────────────────────────────");
  console.log(`  Total question blocks found : ${totalQuestionBlocksFound}`);
  console.log(`  Answer key entries found    : ${answerMap.size}`);
  console.log(`  Successfully matched        : ${matched.length}`);
  console.log(
    `  Failed blocks              : ${
      failedBlocks.length > 0 ? failedBlocks.map((f) => `${f.question_number}(${f.reason})`).join(", ") : "None"
    }`
  );
  console.log(
    `  Missing answers for        : ${
      unmatchedQuestionNumbers.length > 0 ? unmatchedQuestionNumbers.join(", ") : "None"
    }`
  );
  console.log(`  Total inserted             : ${inserted?.length ?? 0}`);
  console.log("\n  Done.\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
