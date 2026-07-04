"use server";

import { getAdminClient } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { ok, fail, run, pageRange } from "./_helpers";

export interface ActivityRow {
    id: string;
    action: string;
    table_name: string;
    record_id: string | null;
    admin_email: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export async function getActivity(page = 1) {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { from, to, page: p } = pageRange(page);
        const { data, error, count } = await supa
            .from("audit_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);
        if (error) return fail(error.message);
        return ok({
            items: (data || []) as unknown as ActivityRow[],
            total: count || 0,
            page: p,
        });
    });
}
