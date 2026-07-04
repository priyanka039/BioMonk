"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/logger";
import { parsePdf } from "@/lib/parser";
import { ok, fail, run, pageRange, type ActionResult } from "./_helpers";

const MAX_SIZE = 50 * 1024 * 1024;
const LOCK_STALE_MS = 2 * 60 * 1000; // 2 min
const VALID_TYPES = ["chapter_test", "full_mock", "dpp"];
const VALID_SUBJECTS = ["biology", "chemistry", "physics"];

export interface TestRow {
    id: string;
    title: string;
    type: string;
    subject: string | null;
    is_active: boolean;
    duration_minutes: number;
    total_marks: number;
    batch_id: string;
    chapter_id: string | null;
    batch_name: string | null;
    chapter_name: string | null;
    question_count: number;
    current_version: number | null;
    created_at: string;
}

export async function getTestFormData() {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const [batches, chapters] = await Promise.all([
            supa.from("batches").select("id, name").order("name"),
            supa.from("chapters").select("id, name, class_level").order("order_index"),
        ]);
        return ok({ batches: batches.data || [], chapters: chapters.data || [] });
    });
}

export async function getTests(page = 1, search = "") {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { from, to, page: p } = pageRange(page);

        let query = supa
            .from("tests")
            .select("*, batch:batches(name), chapter:chapters(name)", { count: "exact" })
            .is("deleted_at", null)
            .order("created_at", { ascending: false, nullsFirst: false })
            .range(from, to);
        if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);

        const { data: tests, error, count } = await query;
        if (error) return fail(error.message);

        const ids = (tests || []).map((t) => t.id);
        const currentByTest = new Map<string, { id: string; version_number: number; question_count: number }>();
        if (ids.length) {
            const { data: versions } = await supa
                .from("test_versions")
                .select("id, test_id, version_number, question_count")
                .in("test_id", ids)
                .eq("is_current", true);
            for (const v of versions || []) {
                currentByTest.set(v.test_id, {
                    id: v.id,
                    version_number: v.version_number,
                    question_count: v.question_count,
                });
            }
        }

        // Legacy tests (populated by the old CLI) have no version row — count directly.
        const legacyIds = ids.filter((id) => !currentByTest.has(id));
        const legacyCount = new Map<string, number>();
        if (legacyIds.length) {
            const { data: qrows } = await supa
                .from("questions")
                .select("test_id")
                .in("test_id", legacyIds);
            for (const q of qrows || []) {
                legacyCount.set(q.test_id, (legacyCount.get(q.test_id) || 0) + 1);
            }
        }

        const items: TestRow[] = (tests || []).map((t) => {
            const cur = currentByTest.get(t.id);
            const batch = Array.isArray(t.batch) ? t.batch[0] : t.batch;
            const chapter = Array.isArray(t.chapter) ? t.chapter[0] : t.chapter;
            return {
                id: t.id,
                title: t.title,
                type: t.type,
                subject: t.subject ?? null,
                is_active: t.is_active,
                duration_minutes: t.duration_minutes,
                total_marks: t.total_marks,
                batch_id: t.batch_id,
                chapter_id: t.chapter_id,
                batch_name: (batch as { name?: string } | null)?.name ?? null,
                chapter_name: (chapter as { name?: string } | null)?.name ?? null,
                question_count: cur ? cur.question_count : legacyCount.get(t.id) || 0,
                current_version: cur ? cur.version_number : null,
                created_at: t.created_at ?? t.scheduled_at ?? new Date(0).toISOString(),
            };
        });

        return ok({ items, total: count || 0, page: p });
    });
}

export interface CreateTestInput {
    title: string;
    type: string;
    subject?: string;
    batch_id: string;
    chapter_id?: string;
    duration_minutes: number;
    marks_correct: number;
    marks_wrong: number;
}

export type CreateTestResult =
    | { success: true; id: string }
    | { success: false; error: string; duplicate?: boolean };

export async function createTest(
    input: CreateTestInput,
    allowDuplicate = false
): Promise<CreateTestResult> {
    try {
        const session = await assertAdmin();
        const t0 = Date.now();
        const title = (input.title || "").trim();

        if (!title) return { success: false, error: "Title is required." };
        if (!VALID_TYPES.includes(input.type)) return { success: false, error: "Invalid test type." };
        if (!input.batch_id) return { success: false, error: "Please select a batch." };
        if (input.subject && !VALID_SUBJECTS.includes(input.subject)) {
            return { success: false, error: "Invalid subject." };
        }
        const duration = Number(input.duration_minutes);
        if (!Number.isFinite(duration) || duration <= 0) {
            return { success: false, error: "Duration must be a positive number of minutes." };
        }
        const marksCorrect = Number(input.marks_correct);
        const marksWrong = Number(input.marks_wrong);
        if (!Number.isFinite(marksCorrect) || marksCorrect <= 0) {
            return { success: false, error: "Marks for a correct answer must be positive." };
        }

        const supa = getAdminClient();

        // Duplicate title within the same batch → warn, don't block.
        const { data: dup } = await supa
            .from("tests")
            .select("id")
            .eq("batch_id", input.batch_id)
            .ilike("title", title)
            .is("deleted_at", null)
            .maybeSingle();
        if (dup && !allowDuplicate) {
            return {
                success: false,
                duplicate: true,
                error: `A test named "${title}" already exists in this batch. Create another one anyway?`,
            };
        }

        const { data: inserted, error } = await supa
            .from("tests")
            .insert({
                title,
                type: input.type,
                subject: input.subject || null,
                batch_id: input.batch_id,
                chapter_id: input.chapter_id || null,
                duration_minutes: duration,
                marks_correct: marksCorrect,
                marks_wrong: Number.isFinite(marksWrong) ? marksWrong : -1,
                total_marks: Math.max(1, marksCorrect), // synced on extraction
                is_active: false,
                created_by: session.email,
            })
            .select("id")
            .single();

        if (error) return { success: false, error: error.message };

        await writeAudit("create", "tests", inserted.id, { title, durationMs: Date.now() - t0 });
        revalidatePath("/admin/tests");
        return { success: true, id: inserted.id };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "NOT_AUTHENTICATED") {
            return { success: false, error: "Your session expired. Please sign in again." };
        }
        return { success: false, error: msg };
    }
}

export interface ExtractResult {
    success: boolean;
    error?: string;
    report?: {
        format: string;
        extracted: number;
        failed: { num: number; reason: string }[];
        unmatched: number[];
    };
}

// ATOMIC extraction: parse fully in memory, then all-or-nothing DB writes.
export async function extractTestQuestions(
    testId: string,
    formData: FormData
): Promise<ExtractResult> {
    const t0 = Date.now();
    let lockAcquired = false;
    let uploadedPath: string | null = null;
    let versionId: string | null = null;
    const supa = getAdminClient();

    async function clearLock() {
        if (lockAcquired) {
            await supa.from("tests").update({ extracting_at: null }).eq("id", testId);
        }
    }

    try {
        await assertAdmin();

        const { data: test } = await supa
            .from("tests")
            .select("id, extracting_at, marks_correct, subject")
            .eq("id", testId)
            .maybeSingle();
        if (!test) return { success: false, error: "Test not found." };

        // ── Lock (reject concurrent/racing extraction) ──
        if (test.extracting_at) {
            const age = Date.now() - new Date(test.extracting_at).getTime();
            if (age < LOCK_STALE_MS) {
                return { success: false, error: "An extraction is already running for this test. Please wait." };
            }
        }
        await supa.from("tests").update({ extracting_at: new Date().toISOString() }).eq("id", testId);
        lockAcquired = true;

        // ── Validate PDF ──
        const file = formData.get("file") as File | null;
        if (!file) { await clearLock(); return { success: false, error: "Please choose a PDF file." }; }
        if (file.size === 0) { await clearLock(); return { success: false, error: "The file is empty." }; }
        if (file.size > MAX_SIZE) { await clearLock(); return { success: false, error: "File is larger than 50 MB." }; }
        if (file.type && file.type !== "application/pdf") {
            await clearLock();
            return { success: false, error: "Only PDF files are allowed." };
        }

        const bytes = Buffer.from(await file.arrayBuffer());
        if (bytes.length < 4 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
            await clearLock();
            return { success: false, error: "That file is not a valid PDF." };
        }
        const pdfHash = crypto.createHash("sha256").update(bytes).digest("hex");

        // ── Upload PDF (UUID name) ──
        const filePath = `tests/${testId}/${crypto.randomUUID()}.pdf`;
        const { error: upErr } = await supa.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
        if (upErr) {
            await clearLock();
            return { success: false, error: `Upload failed: ${upErr.message}` };
        }
        uploadedPath = filePath;

        // ── Parse FULLY in memory (before any question write) ──
        const { questions, report } = await parsePdf(bytes);
        const valid = questions.filter((q) => q.correct_option !== null);

        // ── Zero questions → clean up, no version, return report ──
        if (valid.length === 0) {
            await supa.storage.from(STORAGE_BUCKET).remove([filePath]);
            uploadedPath = null;
            await clearLock();
            await writeAudit("extract", "tests", testId, {
                extracted: 0,
                format: report.format,
                durationMs: Date.now() - t0,
            });
            return {
                success: false,
                error: "No questions could be extracted from this PDF. Nothing was saved.",
                report: { format: report.format, extracted: 0, failed: report.failed, unmatched: report.unmatched },
            };
        }

        // ── New version row ──
        const { data: maxRow } = await supa
            .from("test_versions")
            .select("version_number")
            .eq("test_id", testId)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();
        const nextVersion = (maxRow?.version_number ?? 0) + 1;

        const { data: version, error: verErr } = await supa
            .from("test_versions")
            .insert({
                test_id: testId,
                version_number: nextVersion,
                pdf_path: filePath,
                pdf_hash: pdfHash,
                question_count: valid.length,
                extraction_report: report,
                is_current: false,
            })
            .select("id")
            .single();
        if (verErr || !version) {
            await supa.storage.from(STORAGE_BUCKET).remove([filePath]);
            uploadedPath = null;
            await clearLock();
            return { success: false, error: `Could not create version: ${verErr?.message}` };
        }
        versionId = version.id;

        // ── Insert all questions for this version ──
        const rows = valid.map((q, i) => ({
            test_id: testId,
            test_version_id: version.id,
            order_index: i + 1,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_option: q.correct_option,
            explanation: null,
        }));
        const { error: insErr } = await supa.from("questions").insert(rows);
        if (insErr) {
            // Rollback: deleting the version cascades to any inserted questions.
            await supa.from("test_versions").delete().eq("id", version.id);
            await supa.storage.from(STORAGE_BUCKET).remove([filePath]);
            uploadedPath = null;
            versionId = null;
            await clearLock();
            log.error("test.extract.insert_failed_rolledback", { testId, error: insErr.message });
            return { success: false, error: `Could not save questions: ${insErr.message}` };
        }

        // ── Finalize: this version becomes current; sync test row ──
        await supa.from("test_versions").update({ is_current: false }).eq("test_id", testId);
        await supa.from("test_versions").update({ is_current: true }).eq("id", version.id);

        const marksCorrect = test.marks_correct ?? 4;
        await supa
            .from("tests")
            .update({
                original_file_path: filePath,
                total_marks: valid.length * marksCorrect,
                extracting_at: null,
            })
            .eq("id", testId);
        lockAcquired = false;

        await writeAudit("extract", "tests", testId, {
            version: nextVersion,
            extracted: valid.length,
            format: report.format,
            failed: report.failed.length,
            durationMs: Date.now() - t0,
        });
        revalidatePath("/admin/tests");
        log.info("test.extract.success", {
            testId,
            version: nextVersion,
            extracted: valid.length,
            durationMs: Date.now() - t0,
        });

        return {
            success: true,
            report: { format: report.format, extracted: valid.length, failed: report.failed, unmatched: report.unmatched },
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Best-effort cleanup of anything partially created.
        if (versionId) await supa.from("test_versions").delete().eq("id", versionId).then(() => {}, () => {});
        if (uploadedPath) await supa.storage.from(STORAGE_BUCKET).remove([uploadedPath]).then(() => {}, () => {});
        await clearLock();
        log.error("test.extract.exception", { testId, error: msg });
        if (msg === "NOT_AUTHENTICATED") {
            return { success: false, error: "Your session expired. Please sign in again." };
        }
        return { success: false, error: "Unexpected error during extraction. Nothing was saved." };
    }
}

export async function toggleTestStatus(testId: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { data: test } = await supa
            .from("tests")
            .select("id, is_active")
            .eq("id", testId)
            .maybeSingle();
        if (!test) return fail("Test not found.");

        // Activation guard: don't publish an empty test.
        if (!test.is_active) {
            const { data: cur } = await supa
                .from("test_versions")
                .select("question_count")
                .eq("test_id", testId)
                .eq("is_current", true)
                .maybeSingle();
            let count = cur?.question_count ?? 0;
            if (!cur) {
                // Legacy test without versions.
                const { count: qc } = await supa
                    .from("questions")
                    .select("*", { count: "exact", head: true })
                    .eq("test_id", testId);
                count = qc || 0;
            }
            if (count === 0) {
                return fail("This test has no questions yet. Upload a PDF and extract before activating.");
            }
        }

        const next = !test.is_active;
        const { error } = await supa.from("tests").update({ is_active: next }).eq("id", testId);
        if (error) return fail(error.message);
        await writeAudit(next ? "activate" : "deactivate", "tests", testId, {});
        revalidatePath("/admin/tests");
        revalidatePath("/admin/archive");
        return ok();
    });
}

export async function archiveTest(id: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { data: before } = await supa
            .from("tests")
            .select("id, title, is_active")
            .eq("id", id)
            .maybeSingle();
        // Archiving also deactivates so it disappears from students immediately.
        const { error } = await supa
            .from("tests")
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq("id", id)
            .is("deleted_at", null);
        if (error) return fail(error.message);
        await writeAudit("archive", "tests", id, { before });
        revalidatePath("/admin/tests");
        revalidatePath("/admin/archive");
        return ok();
    });
}

export async function restoreTest(id: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { error } = await supa.from("tests").update({ deleted_at: null }).eq("id", id);
        if (error) return fail(error.message);
        await writeAudit("restore", "tests", id, {});
        revalidatePath("/admin/tests");
        revalidatePath("/admin/archive");
        return ok();
    });
}
