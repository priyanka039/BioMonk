"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { ok, fail, run, pageRange, type ActionResult } from "./_helpers";

export interface AnnouncementRow {
    id: string;
    title: string;
    body: string;
    batch_id: string | null;
    batch_name: string | null;
    priority: string;
    starts_at: string;
    expires_at: string | null;
    created_by: string;
    created_at: string;
    status: "scheduled" | "live" | "expired";
}

function announcementStatus(row: {
    starts_at: string;
    expires_at: string | null;
}): AnnouncementRow["status"] {
    const now = Date.now();
    if (new Date(row.starts_at).getTime() > now) return "scheduled";
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) return "expired";
    return "live";
}

export async function getAnnouncements(page = 1, batchId?: string) {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { from, to, page: p } = pageRange(page);

        let query = supa
            .from("announcements")
            .select("*, batch:batches(name)", { count: "exact" })
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .range(from, to);

        if (batchId) query = query.or(`batch_id.eq.${batchId},batch_id.is.null`);

        const { data, error, count } = await query;
        if (error) return fail(error.message);

        const items: AnnouncementRow[] = (data || []).map((row) => {
            const batch = Array.isArray(row.batch) ? row.batch[0] : row.batch;
            return {
                id: row.id,
                title: row.title,
                body: row.body,
                batch_id: row.batch_id,
                batch_name: (batch as { name?: string } | null)?.name ?? (row.batch_id ? null : "All batches"),
                priority: row.priority,
                starts_at: row.starts_at,
                expires_at: row.expires_at,
                created_by: row.created_by,
                created_at: row.created_at,
                status: announcementStatus(row),
            };
        });

        return ok({ items, total: count || 0, page: p });
    });
}

export async function createAnnouncement(
    title: string,
    body: string,
    batchId: string | null,
    priority: string,
    expiresAt: string | null
): Promise<ActionResult> {
    return run(async () => {
        const session = await assertAdmin();
        const t = (title || "").trim();
        const b = (body || "").trim();
        if (!t) return fail("Title is required.");
        if (!b) return fail("Message body is required.");
        if (!["normal", "high"].includes(priority)) return fail("Invalid priority.");

        const supa = getAdminClient();
        const { data, error } = await supa
            .from("announcements")
            .insert({
                title: t,
                body: b,
                batch_id: batchId || null,
                priority,
                expires_at: expiresAt || null,
                created_by: session.email,
            })
            .select("id")
            .single();
        if (error) return fail(error.message);

        await writeAudit("create", "announcements", data.id, { title: t, batch_id: batchId });
        revalidatePath("/admin/announcements");
        return ok();
    });
}

export async function archiveAnnouncement(id: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { error } = await supa
            .from("announcements")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);
        if (error) return fail(error.message);

        await writeAudit("archive", "announcements", id, {});
        revalidatePath("/admin/announcements");
        return ok();
    });
}
