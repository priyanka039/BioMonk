"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { ok, fail, run } from "./_helpers";

export interface ArchivedMaterial {
    id: string;
    title: string;
    type: string;
    deleted_at: string;
    chapter?: { name: string } | null;
}
export interface ArchivedTest {
    id: string;
    title: string;
    is_active: boolean;
    deleted_at: string;
}

export async function getArchived() {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const [mats, tests] = await Promise.all([
            supa
                .from("study_materials")
                .select("id, title, type, deleted_at, chapter:chapters(name)")
                .not("deleted_at", "is", null)
                .order("deleted_at", { ascending: false }),
            supa
                .from("tests")
                .select("id, title, is_active, deleted_at")
                .not("deleted_at", "is", null)
                .order("deleted_at", { ascending: false }),
        ]);
        return ok({
            materials: (mats.data || []) as unknown as ArchivedMaterial[],
            tests: (tests.data || []) as unknown as ArchivedTest[],
        });
    });
}

export async function restoreArchived(kind: "material" | "test", id: string) {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const table = kind === "material" ? "study_materials" : "tests";
        const { error } = await supa
            .from(table)
            .update({ deleted_at: null })
            .eq("id", id);
        if (error) return fail(error.message);
        await writeAudit("restore", table, id, {});
        revalidatePath("/admin/archive");
        revalidatePath(kind === "material" ? "/admin/materials" : "/admin/tests");
        return ok();
    });
}
