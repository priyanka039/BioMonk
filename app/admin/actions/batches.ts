"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { getDaysUntilDate } from "@/lib/config";
import { ok, fail, run, pageRange, type ActionResult } from "./_helpers";

export interface BatchRow {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    created_at: string;
    student_count?: number;
    chapter_count?: number;
    test_count?: number;
}

export interface BatchDashboard {
    batch: BatchRow;
    students: number;
    chapters: number;
    locked: number;
    materials: number;
    tests: number;
    announcements: number;
    examCountdown: number;
}

export async function getBatches(page = 1) {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { from, to, page: p } = pageRange(page);

        const { data: batches, error, count } = await supa
            .from("batches")
            .select("*", { count: "exact" })
            .order("name")
            .range(from, to);
        if (error) return fail(error.message);

        const ids = (batches || []).map((b) => b.id);
        const students = new Map<string, number>();
        const chapters = new Map<string, number>();
        const tests = new Map<string, number>();

        if (ids.length) {
            const [profRes, chapRes, testRes] = await Promise.all([
                supa.from("profiles").select("batch_id").in("batch_id", ids).is("deleted_at", null),
                supa.from("chapters").select("batch_id").in("batch_id", ids),
                supa.from("tests").select("batch_id").in("batch_id", ids).is("deleted_at", null),
            ]);
            for (const r of profRes.data || []) {
                if (r.batch_id) students.set(r.batch_id, (students.get(r.batch_id) || 0) + 1);
            }
            for (const r of chapRes.data || []) {
                if (r.batch_id) chapters.set(r.batch_id, (chapters.get(r.batch_id) || 0) + 1);
            }
            for (const r of testRes.data || []) {
                if (r.batch_id) tests.set(r.batch_id, (tests.get(r.batch_id) || 0) + 1);
            }
        }

        const items: BatchRow[] = (batches || []).map((b) => ({
            ...b,
            student_count: students.get(b.id) || 0,
            chapter_count: chapters.get(b.id) || 0,
            test_count: tests.get(b.id) || 0,
        }));

        return ok({ items, total: count || 0, page: p });
    });
}

/** Lightweight list for dropdowns (students, tests, chapters). */
export async function getBatchesList() {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { data, error } = await supa
            .from("batches")
            .select("id, name, is_active")
            .order("name");
        if (error) return fail(error.message);
        return ok(data || []);
    });
}

export async function getBatchDashboard(batchId: string) {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();

        const { data: batch, error } = await supa
            .from("batches")
            .select("*")
            .eq("id", batchId)
            .maybeSingle();
        if (error) return fail(error.message);
        if (!batch) return fail("Batch not found.");

        const now = new Date().toISOString();

        const [
            studentsRes,
            chaptersRes,
            lockedRes,
            testsRes,
            chapterIdsRes,
            announcementsRes,
        ] = await Promise.all([
            supa
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("batch_id", batchId)
                .is("deleted_at", null),
            supa
                .from("chapters")
                .select("id", { count: "exact", head: true })
                .eq("batch_id", batchId),
            supa
                .from("chapters")
                .select("id", { count: "exact", head: true })
                .eq("batch_id", batchId)
                .eq("is_locked", true),
            supa
                .from("tests")
                .select("id", { count: "exact", head: true })
                .eq("batch_id", batchId)
                .is("deleted_at", null),
            supa.from("chapters").select("id").eq("batch_id", batchId),
            supa
                .from("announcements")
                .select("id", { count: "exact", head: true })
                .is("deleted_at", null)
                .lte("starts_at", now)
                .or(`expires_at.is.null,expires_at.gt.${now}`)
                .or(`batch_id.eq.${batchId},batch_id.is.null`),
        ]);

        const chapterIds = (chapterIdsRes.data || []).map((c) => c.id);
        let materialsCount = 0;
        if (chapterIds.length) {
            const { count } = await supa
                .from("study_materials")
                .select("id", { count: "exact", head: true })
                .in("chapter_id", chapterIds)
                .is("deleted_at", null);
            materialsCount = count || 0;
        }

        const dashboard: BatchDashboard = {
            batch: batch as BatchRow,
            students: studentsRes.count || 0,
            chapters: chaptersRes.count || 0,
            locked: lockedRes.count || 0,
            materials: materialsCount,
            tests: testsRes.count || 0,
            announcements: announcementsRes.count || 0,
            examCountdown: getDaysUntilDate(batch.end_date),
        };

        return ok(dashboard);
    });
}

export async function createBatch(
    name: string,
    description: string,
    startDate: string,
    endDate: string
): Promise<ActionResult<{ id: string }>> {
    return run(async () => {
        const session = await assertAdmin();
        const n = (name || "").trim();
        if (!n) return fail("Batch name is required.");
        if (!startDate || !endDate) return fail("Start and NEET exam dates are required.");

        const supa = getAdminClient();
        const { data, error } = await supa
            .from("batches")
            .insert({
                name: n,
                description: (description || "").trim(),
                start_date: startDate,
                end_date: endDate,
                is_active: true,
            })
            .select("id")
            .single();
        if (error) return fail(error.message);

        await writeAudit("create", "batches", data.id, { name: n, start_date: startDate, end_date: endDate });
        revalidatePath("/admin/batches");
        return ok({ id: data.id });
    });
}

export async function updateBatch(
    id: string,
    name: string,
    description: string,
    startDate: string,
    endDate: string
): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const n = (name || "").trim();
        if (!n) return fail("Batch name is required.");
        if (!startDate || !endDate) return fail("Start and NEET exam dates are required.");

        const supa = getAdminClient();
        const { data: before } = await supa.from("batches").select("*").eq("id", id).maybeSingle();

        const { error } = await supa
            .from("batches")
            .update({
                name: n,
                description: (description || "").trim(),
                start_date: startDate,
                end_date: endDate,
            })
            .eq("id", id);
        if (error) return fail(error.message);

        await writeAudit("update", "batches", id, {
            before,
            after: { name: n, start_date: startDate, end_date: endDate },
        });
        revalidatePath("/admin/batches");
        revalidatePath(`/admin/batches/${id}`);
        return ok();
    });
}

export async function toggleBatchActive(id: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { data: row } = await supa.from("batches").select("is_active").eq("id", id).maybeSingle();
        if (!row) return fail("Batch not found.");

        const { error } = await supa.from("batches").update({ is_active: !row.is_active }).eq("id", id);
        if (error) return fail(error.message);

        await writeAudit(row.is_active ? "deactivate" : "activate", "batches", id, {});
        revalidatePath("/admin/batches");
        revalidatePath(`/admin/batches/${id}`);
        return ok();
    });
}
