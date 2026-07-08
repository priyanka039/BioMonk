"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/logger";
import { ok, fail, run, pageRange, type ActionResult } from "./_helpers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface StudentRow {
    id: string;
    full_name: string;
    email: string;
    batch_id: string | null;
    batch_name: string | null;
    attempts: number;
    avg_score: number | null;
    last_active: string | null;
    created_at: string;
}

export async function getBatches() {
    const { getBatchesList } = await import("./batches");
    return getBatchesList();
}

export async function getStudents(page = 1, search = "") {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { from, to, page: p } = pageRange(page);

        let query = supa
            .from("profiles")
            .select("id, full_name, batch_id, created_at, batch:batches(name)", {
                count: "exact",
            })
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .range(from, to);
        if (search.trim()) query = query.ilike("full_name", `%${search.trim()}%`);

        const { data: profiles, error, count } = await query;
        if (error) return fail(error.message);

        const ids = (profiles || []).map((s) => s.id);

        // One aggregated query for attempts across the visible page (no N+1).
        const statsById = new Map<
            string,
            { attempts: number; sum: number; last: string | null }
        >();
        if (ids.length) {
            const { data: attempts } = await supa
                .from("test_attempts")
                .select("student_id, score, submitted_at")
                .in("student_id", ids)
                .eq("is_completed", true);
            for (const a of attempts || []) {
                const cur = statsById.get(a.student_id) || { attempts: 0, sum: 0, last: null };
                cur.attempts += 1;
                cur.sum += a.score ?? 0;
                if (!cur.last || (a.submitted_at && a.submitted_at > cur.last)) {
                    cur.last = a.submitted_at;
                }
                statsById.set(a.student_id, cur);
            }
        }

        // Emails live in auth.users — fetch once and map.
        const emailById = new Map<string, string>();
        try {
            const { data: authList } = await supa.auth.admin.listUsers({
                page: 1,
                perPage: 1000,
            });
            for (const u of authList?.users || []) emailById.set(u.id, u.email || "");
        } catch (e) {
            log.warn("students.email_lookup_failed", {
                error: e instanceof Error ? e.message : String(e),
            });
        }

        const items: StudentRow[] = (profiles || []).map((s) => {
            const st = statsById.get(s.id);
            const batch = Array.isArray(s.batch) ? s.batch[0] : s.batch;
            return {
                id: s.id,
                full_name: s.full_name,
                email: emailById.get(s.id) || "",
                batch_id: s.batch_id,
                batch_name: (batch as { name?: string } | null)?.name ?? null,
                attempts: st?.attempts ?? 0,
                avg_score:
                    st && st.attempts > 0 ? Math.round(st.sum / st.attempts) : null,
                last_active: st?.last ?? null,
                created_at: s.created_at,
            };
        });

        return ok({ items, total: count || 0, page: p });
    });
}

export async function createStudentUser(
    name: string,
    email: string,
    password: string,
    batchId: string
): Promise<ActionResult> {
    return run(async () => {
        const session = await assertAdmin();
        const t0 = Date.now();
        const fullName = (name || "").trim();
        const normEmail = (email || "").trim().toLowerCase();

        if (!fullName) return fail("Student name is required.");
        if (!EMAIL_RE.test(normEmail)) return fail("Please enter a valid email address.");
        if (!password || password.length < 8) {
            return fail("Password must be at least 8 characters.");
        }
        if (!batchId) return fail("Please select a batch.");

        const supa = getAdminClient();
        const { data: created, error } = await supa.auth.admin.createUser({
            email: normEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
        });

        if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
                return fail("A student with that email already exists.");
            }
            return fail(error.message);
        }

        const userId = created.user?.id;
        if (!userId) return fail("Could not create the student account.");

        // Ensure the profile (created by DB trigger) has name, batch, created_by.
        const { error: profErr } = await supa
            .from("profiles")
            .update({ full_name: fullName, batch_id: batchId, created_by: session.email })
            .eq("id", userId);
        if (profErr) {
            log.warn("student.profile_update_failed", { userId, error: profErr.message });
        }

        await writeAudit("create", "profiles", userId, {
            full_name: fullName,
            email: normEmail,
            batch_id: batchId,
            durationMs: Date.now() - t0,
        });
        revalidatePath("/admin/students");
        return ok();
    });
}

export async function updateStudent(
    id: string,
    fullName: string,
    batchId: string
): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const name = (fullName || "").trim();
        if (!name) return fail("Student name is required.");
        if (!batchId) return fail("Please select a batch.");

        const { data: before } = await supa
            .from("profiles")
            .select("full_name, batch_id")
            .eq("id", id)
            .maybeSingle();

        const { error } = await supa
            .from("profiles")
            .update({ full_name: name, batch_id: batchId })
            .eq("id", id);
        if (error) return fail(error.message);

        await writeAudit("update", "profiles", id, {
            before,
            after: { full_name: name, batch_id: batchId },
        });
        revalidatePath("/admin/students");
        return ok();
    });
}

export async function resetStudentPassword(
    id: string,
    newPassword: string
): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        if (!newPassword || newPassword.length < 8) {
            return fail("Password must be at least 8 characters.");
        }
        const supa = getAdminClient();
        const { error } = await supa.auth.admin.updateUserById(id, {
            password: newPassword,
        });
        if (error) return fail(error.message);
        await writeAudit("update", "profiles", id, { field: "password" });
        return ok();
    });
}

export async function getStudentAttempts(studentId: string) {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { data, error } = await supa
            .from("test_attempts")
            .select("id, score, max_score, submitted_at, is_completed, test:tests(title)")
            .eq("student_id", studentId)
            .order("submitted_at", { ascending: false, nullsFirst: false });
        if (error) return fail(error.message);
        return ok(data || []);
    });
}
