"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { ok, fail, run, type ActionResult } from "./_helpers";

export interface ChapterRow {
    id: string;
    name: string;
    class_level: string;
    order_index: number;
    batch_id: string;
    is_locked: boolean;
}

export async function getChaptersForBatch(batchId: string) {
    return run(async () => {
        await assertAdmin();
        if (!batchId) return fail("Please select a batch.");
        const supa = getAdminClient();
        const { data, error } = await supa
            .from("chapters")
            .select("id, name, class_level, order_index, batch_id, is_locked")
            .eq("batch_id", batchId)
            .order("order_index");
        if (error) return fail(error.message);
        return ok((data || []) as ChapterRow[]);
    });
}

export async function createChapter(
    batchId: string,
    name: string,
    classLevel: string,
    orderIndex: number
): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const n = (name || "").trim();
        if (!batchId) return fail("Batch is required.");
        if (!n) return fail("Chapter name is required.");
        if (!["XI", "XII"].includes(classLevel)) return fail("Class must be XI or XII.");

        const supa = getAdminClient();
        const { data, error } = await supa
            .from("chapters")
            .insert({
                name: n,
                class_level: classLevel,
                batch_id: batchId,
                order_index: orderIndex,
                is_locked: false,
            })
            .select("id")
            .single();
        if (error) return fail(error.message);

        await writeAudit("create", "chapters", data.id, { name: n, batch_id: batchId });
        revalidatePath("/admin/chapters");
        revalidatePath(`/admin/batches/${batchId}`);
        return ok();
    });
}

export async function updateChapter(
    id: string,
    name: string,
    classLevel: string,
    orderIndex: number
): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const n = (name || "").trim();
        if (!n) return fail("Chapter name is required.");
        if (!["XI", "XII"].includes(classLevel)) return fail("Class must be XI or XII.");

        const supa = getAdminClient();
        const { data: before } = await supa.from("chapters").select("*").eq("id", id).maybeSingle();

        const { error } = await supa
            .from("chapters")
            .update({ name: n, class_level: classLevel, order_index: orderIndex })
            .eq("id", id);
        if (error) return fail(error.message);

        await writeAudit("update", "chapters", id, { before, after: { name: n, class_level: classLevel, order_index: orderIndex } });
        revalidatePath("/admin/chapters");
        if (before?.batch_id) revalidatePath(`/admin/batches/${before.batch_id}`);
        return ok();
    });
}

export async function toggleChapterLock(id: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { data: row } = await supa.from("chapters").select("is_locked, batch_id, name").eq("id", id).maybeSingle();
        if (!row) return fail("Chapter not found.");

        const { error } = await supa.from("chapters").update({ is_locked: !row.is_locked }).eq("id", id);
        if (error) return fail(error.message);

        await writeAudit(row.is_locked ? "restore" : "archive", "chapters", id, {
            name: row.name,
            action: row.is_locked ? "unlocked" : "locked",
        });
        revalidatePath("/admin/chapters");
        if (row.batch_id) revalidatePath(`/admin/batches/${row.batch_id}`);
        return ok();
    });
}
