/**
 * BioMonk — PDF Question Parser (library)
 * =======================================
 * The proven multi-format extraction logic, moved out of the CLI script so it
 * can run in-memory from a Buffer (server action) or from disk (CLI wrapper).
 *
 * Supports: DPP answer-key grids, inline "Answer key : x", table (Question/
 * Option/Answer) blocks, chapter two-row tables, parentheses/plain pairs, and
 * inline Question/Option/Answer layouts.
 *
 * Pure functions — no DB, no filesystem, no console noise. Returns questions +
 * a simple report (format, extracted, failed, unmatched, durationMs, rawOutput).
 */

export interface ParsedQuestion {
    question_number: number;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: "A" | "B" | "C" | "D" | null;
}

export interface ExtractionReport {
    format: string;
    extracted: number;
    failed: { num: number; reason: string }[];
    unmatched: number[];
    durationMs: number;
    rawOutput: string;
}

export interface ParseResult {
    questions: ParsedQuestion[];
    report: ExtractionReport;
}

// ─── text utils ──────────────────────────────────────────────
export function normalizeText(s: string) {
    return s.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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

type AnswerKeyMode =
    | "inline_answer_key"
    | "dpp_pairs"
    | "chapter_table"
    | "parentheses_pairs"
    | "plain_pairs"
    | "table_format";

function tokenizeNumericLine(line: string): number[] {
    return line
        .trim()
        .replace(/[^\d\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => Number(t))
        .filter((n) => Number.isFinite(n));
}

function isAllAnswersRow(nums: number[]): boolean {
    return nums.length > 0 && nums.every((n) => n >= 1 && n <= 4);
}

function isLikelyQuestionRow(nums: number[]): boolean {
    if (nums.length === 0) return false;
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    return min >= 1 && max > 4;
}

// "Answer Key" / "Anwer Key" (source PDFs vary).
const answerKeyHeaderRe = /a\s*n\s*s?\s*w\s*e\s*r\s*key/i;

function parseAnswerKey(fullText: string): {
    answerMap: Map<number, number>;
    answerKeyText: string | null;
    mode: AnswerKeyMode | null;
} {
    const inlineAnswerKeyRe = /Answer\s*key\s*:\s*[abcd]/gi;
    const inlineMatches = fullText.match(inlineAnswerKeyRe);
    if (inlineMatches && inlineMatches.length >= 5) {
        return { answerMap: new Map<number, number>(), answerKeyText: fullText, mode: "inline_answer_key" };
    }

    const headerMatch = answerKeyHeaderRe.exec(fullText);
    const headerIdx = headerMatch && headerMatch.index !== undefined ? headerMatch.index : -1;

    const answerKeyText = headerIdx >= 0 ? fullText.slice(headerIdx) : null;
    const scanText = answerKeyText ?? fullText;

    const { questions: tableQuestions } = parseTableFormatQuestions(scanText);
    if (tableQuestions.length >= 5) {
        return { answerMap: new Map<number, number>(), answerKeyText: scanText, mode: "table_format" };
    }

    if (!answerKeyText) {
        return { answerMap: new Map<number, number>(), answerKeyText: null, mode: null };
    }

    const answerMap = new Map<number, number>();

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

    const lines = normalizeText(answerKeyText)
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    for (let i = 0; i < lines.length - 1; i++) {
        const qNums = tokenizeNumericLine(lines[i]);
        const aNums = tokenizeNumericLine(lines[i + 1]);
        if (!isLikelyQuestionRow(qNums) || !isAllAnswersRow(aNums)) continue;
        if (qNums.length !== aNums.length) continue;

        for (let j = i; j < lines.length - 1; j++) {
            const qs = tokenizeNumericLine(lines[j]);
            const as = tokenizeNumericLine(lines[j + 1]);
            if (!isLikelyQuestionRow(qs) || !isAllAnswersRow(as) || qs.length !== as.length) break;
            for (let k = 0; k < qs.length; k++) {
                const q = qs[k];
                const a = as[k];
                if (q && a) answerMap.set(q, a);
            }
            j++;
            i = j;
        }
        return { answerMap, answerKeyText, mode: "chapter_table" };
    }

    const re = /(\d{1,5})\s*[\.\)]?\s+([1-4])\b/gm;
    let match: RegExpExecArray | null;
    while ((match = re.exec(answerKeyText))) {
        const qNum = Number(match[1]);
        const ans = Number(match[2]);
        if (Number.isFinite(qNum) && Number.isFinite(ans)) answerMap.set(qNum, ans);
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
        if (i < lines.length && /^Type\b/i.test(lines[i])) i++;

        const optVals: string[] = [];
        while (i < lines.length && /^Option\b/i.test(lines[i]) && optVals.length < 4) {
            optVals.push(lines[i].replace(/^Option\s*/i, "").trim());
            i++;
        }
        while (i < lines.length && !/^Answer\b/i.test(lines[i]) && !/^Question\b/i.test(lines[i])) i++;

        let ansDigit: number | null = null;
        if (i < lines.length && /^Answer\b/i.test(lines[i])) {
            const ansStr = lines[i].replace(/^Answer\s*/i, "").trim();
            const m = ansStr.match(/([1-4])\b/);
            ansDigit = m ? Number(m[1]) : null;
            i++;
        }
        if (ansDigit === null || ansDigit < 1 || ansDigit > 4) continue;

        qCounter++;
        questions.push({
            question_number: qCounter,
            question_text: qText || "Refer to the question text in the original table.",
            option_a: optVals[0] && optVals[0].length > 0 ? optVals[0] : placeholder,
            option_b: optVals[1] && optVals[1].length > 0 ? optVals[1] : placeholder,
            option_c: optVals[2] && optVals[2].length > 0 ? optVals[2] : placeholder,
            option_d: optVals[3] && optVals[3].length > 0 ? optVals[3] : placeholder,
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

    function isJustOptionMarker(s: string): boolean {
        const t = compactSpaces(s);
        if (!t.length) return false;
        if (/^(?:\(\s*[1-4]\s*\)|[1-4]\s*\))(?:\s+(?:\(\s*[1-4]\s*\)|[1-4]\s*\)))+$/.test(t)) return true;
        return false;
    }

    function extractOptionsFallback(blockText: string): Partial<Record<1 | 2 | 3 | 4, string>> {
        const s = normalizeText(blockText);
        const out: Partial<Record<1 | 2 | 3 | 4, string>> = {};
        const markerRe = /(?:^|\n|\s)(?:\(\s*([1-4])\s*\)|([1-4])\s*\))\s*/g;
        const hits: { n: 1 | 2 | 3 | 4; i: number; len: number }[] = [];
        let m: RegExpExecArray | null;
        while ((m = markerRe.exec(s))) {
            const raw = (m[1] || m[2]) ?? "";
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

        if (!option_a || !option_b || !option_c || !option_d) {
            const recovered = extractOptionsFallback(current.blockLines.join("\n"));
            if (!option_a && recovered[1]) option_a = recovered[1];
            if (!option_b && recovered[2]) option_b = recovered[2];
            if (!option_c && recovered[3]) option_c = recovered[3];
            if (!option_d && recovered[4]) option_d = recovered[4];
        }

        if (!question_text) {
            failedBlocks.push({ question_number, reason: "Question text missing in PDF extract; inserted placeholder" });
            question_text = "Refer to the figure/diagram in the original PDF.";
        }

        const placeholder = "Option text not extracted (likely in a figure/table). Refer to the original PDF.";
        const missing: string[] = [];
        if (!option_a) { option_a = placeholder; missing.push("1"); }
        if (!option_b) { option_b = placeholder; missing.push("2"); }
        if (!option_c) { option_c = placeholder; missing.push("3"); }
        if (!option_d) { option_d = placeholder; missing.push("4"); }
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
            correct_option: null,
        });
        current = null;
    }

    for (const line of lines) {
        if (/answer\s*key/i.test(line)) break;

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
                if (isJustOptionMarker(rest)) rest = "";
                current.optLines[optNum].push(rest);
                continue;
            }

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

        current.blockLines.push(line);
        if (current.activeOpt) current.optLines[current.activeOpt].push(line);
        else current.qLines.push(line);
    }

    flushCurrent();

    return { questions, questionNumbersFound, failedBlocks };
}

function parseInlineOptionAnswerQuestions(fullText: string): {
    questions: ParsedQuestion[];
    failedBlocks: { question_number: number; reason: string }[];
} {
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

        if (!question_text) failedBlocks.push({ question_number: current.qNum, reason: "Question text missing" });

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

        if (/^type\b/i.test(line)) continue;
        if (/^solution\b/i.test(line)) { current.afterAnswer = current.correctAns !== null; continue; }
        if (/^(positive marks|negative marks)\b/i.test(line)) { current.afterAnswer = current.correctAns !== null; continue; }

        const ansMatch = line.match(/^answer\s*[:\-]?\s*([1-4])\b/i);
        if (ansMatch) {
            current.correctAns = Number(ansMatch[1]) as 1 | 2 | 3 | 4;
            current.afterAnswer = true;
            current.activeOpt = null;
            continue;
        }

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

        if (current.afterAnswer) continue;
        if (current.activeOpt) current.optLines[current.activeOpt].push(line);
        else current.qLines.push(line);
    }

    flushCurrent();

    return { questions, failedBlocks };
}

function parseInlineAnswerKeyQuestions(fullText: string): {
    questions: ParsedQuestion[];
    failedBlocks: { question_number: number; reason: string }[];
    mismatch?: { answers: number; blocks: number };
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

        const ansMatch = line.match(/^Answer\s*key\s*:\s*([abcd])\s*$/i);
        if (ansMatch) {
            answers.push(ansMatch[1].toUpperCase() as "A" | "B" | "C" | "D");
            continue;
        }
        if (/^\d+\.\s*$/.test(line)) continue;
        if (/^\(([abcd])\)(\s*\t\s*\(([abcd])\))?\s*$/i.test(line)) continue;
        if (/^\([abcd]\)\s+\([abcd]\)\s*$/i.test(line)) continue;
        if (/^(Correct|Wrong)\s*Marks\s*:/i.test(line)) continue;
        if (/^--\s*\d+\s*of\s*\d+\s*--/.test(line)) continue;
        if (/^(Section\s*:|Biology Class|Instructions|Sections:)/i.test(line)) continue;

        contentLines.push(line);
    }

    if (answers.length === 0) return { questions, failedBlocks };

    function splitOptLine(line: string): string[] {
        const parts = line.split(/\t|\s{3,}/).map((p) => p.trim()).filter(Boolean);
        return parts.length >= 2 ? parts.slice(0, 2) : [line];
    }

    type QBlock = { qText: string; opts: string[] };
    const blocks: QBlock[] = [];

    let state: "expecting_question" | "collecting_options" = "expecting_question";
    let currentQText = "";
    let currentOpts: string[] = [];

    const definiteDanglers = new Set([
        "in", "on", "at", "by", "of", "to", "for", "from", "with", "into",
        "under", "over", "about", "between", "among", "through", "around",
        "within", "without", "a", "an", "the",
    ]);

    for (const line of contentLines) {
        if (state === "expecting_question") {
            currentQText = line;
            currentOpts = [];
            state = "collecting_options";
        } else {
            if (currentOpts.length === 0) {
                const lastWord = currentQText.trimEnd().split(/\s+/).pop()
                    ?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
                const lineIsOptionPair = /\t|\s{3,}/.test(line);
                if (definiteDanglers.has(lastWord) && !lineIsOptionPair) {
                    currentQText = currentQText + " " + line;
                    continue;
                }
            }

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

    if (state === "collecting_options" && currentQText) {
        while (currentOpts.length < 4) currentOpts.push("");
        blocks.push({ qText: currentQText, opts: currentOpts.slice(0, 4) });
    }

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

    const mismatch =
        answers.length !== blocks.length
            ? { answers: answers.length, blocks: blocks.length }
            : undefined;

    return { questions, failedBlocks, mismatch };
}

// ─── PDF text extraction (dynamic import → Node-only, bundler-safe) ──
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const mod: unknown = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfMod = mod as any;

    if (typeof pdfMod?.PDFParse === "function") {
        const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const parser = new pdfMod.PDFParse(uint8);
        const out = await parser.getText();
        const text =
            typeof out === "string"
                ? out
                : out && typeof out === "object" && typeof out.text === "string"
                    ? out.text
                    : String(out ?? "");
        await parser.destroy?.();
        return text;
    }

    const pdfParseFn = pdfMod?.default ?? pdfMod;
    if (typeof pdfParseFn !== "function") {
        throw new Error("Unsupported pdf-parse export shape.");
    }
    const data = await pdfParseFn(buffer);
    return data?.text || "";
}

// ─── High-level pipeline over already-extracted text ───────────
export function parseText(fullTextRaw: string): {
    questions: ParsedQuestion[];
    format: string;
    failed: { num: number; reason: string }[];
    unmatched: number[];
    answerKeyEntries: number;
    totalBlocks: number;
    notes: string[];
} {
    const fullText = normalizeText(fullTextRaw || "");
    const { answerMap, answerKeyText, mode } = parseAnswerKey(fullText);

    let questions: ParsedQuestion[] = [];
    let failedBlocks: { question_number: number; reason: string }[] = [];
    let matched: ParsedQuestion[] = [];
    const unmatched: number[] = [];
    const notes: string[] = [];
    let format = "unknown";

    if (mode === "inline_answer_key") {
        format = "inline_answer_key";
        const r = parseInlineAnswerKeyQuestions(fullText);
        questions = r.questions;
        failedBlocks = r.failedBlocks;
        matched = questions;
        if (r.mismatch) {
            notes.push(
                `Answer count (${r.mismatch.answers}) != content blocks (${r.mismatch.blocks}); only ${matched.length} inserted.`
            );
        }
    } else if (answerKeyText && mode === "table_format") {
        format = "table_format";
        const r = parseTableFormatQuestions(answerKeyText);
        questions = r.questions;
        failedBlocks = r.failedBlocks;
        matched = questions;
    } else if (answerKeyText) {
        format = mode ?? "dpp_pairs";
        const headerIdx = fullText.search(answerKeyHeaderRe);
        const questionSection = headerIdx >= 0 ? fullText.slice(0, headerIdx) : fullText;
        const r = parseQuestions(questionSection);
        questions = r.questions;
        failedBlocks = r.failedBlocks;
        for (const q of questions) {
            const ans = answerMap.get(q.question_number);
            if (!ans) {
                unmatched.push(q.question_number);
                continue;
            }
            q.correct_option = toLetter(ans);
            matched.push(q);
        }
    } else {
        format = "inline_answer";
        const r = parseInlineOptionAnswerQuestions(fullText);
        questions = r.questions;
        failedBlocks = r.failedBlocks;
        matched = questions;
    }

    return {
        questions: matched,
        format,
        failed: failedBlocks.map((f) => ({ num: f.question_number, reason: f.reason })),
        unmatched,
        answerKeyEntries: answerMap.size,
        totalBlocks: questions.length + failedBlocks.length,
        notes,
    };
}

function buildRawOutput(
    r: ReturnType<typeof parseText>,
    charCount: number
): string {
    const lines: string[] = [];
    lines.push(`format: ${r.format}`);
    lines.push(`characters extracted: ${charCount}`);
    lines.push(`total blocks found: ${r.totalBlocks}`);
    lines.push(`answer key entries: ${r.answerKeyEntries}`);
    lines.push(`matched (inserted): ${r.questions.length}`);
    lines.push(
        `failed blocks: ${r.failed.length ? r.failed.map((f) => `${f.num}(${f.reason})`).join("; ") : "none"}`
    );
    lines.push(`unmatched question numbers: ${r.unmatched.length ? r.unmatched.join(", ") : "none"}`);
    for (const n of r.notes) lines.push(`note: ${n}`);
    return lines.join("\n");
}

// ─── Full parse from a PDF buffer (server action + CLI use this) ─
export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
    const t0 = Date.now();
    const text = await extractTextFromPdf(buffer);
    const r = parseText(text);
    const report: ExtractionReport = {
        format: r.format,
        extracted: r.questions.length,
        failed: r.failed,
        unmatched: r.unmatched,
        durationMs: Date.now() - t0,
        rawOutput: buildRawOutput(r, (text || "").length),
    };
    return { questions: r.questions, report };
}
