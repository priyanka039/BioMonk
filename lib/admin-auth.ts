import "server-only";
import { cookies } from "next/headers";
import { hashPassword, verifyPassword } from "./password";
import { getAdminClient } from "./admin-supabase";
import {
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    signToken,
    verifyToken,
    isRateLimited,
    recordFailure,
    clearFailures,
    type AdminSession,
} from "./admin-session";
import { log } from "./logger";

function secret(): string {
    const s = process.env.ADMIN_SESSION_SECRET;
    if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
    return s;
}

export { hashPassword, verifyPassword };

// ─── Session cookie (read / write / clear) ───────────────────
export async function getAdminSession(): Promise<AdminSession | null> {
    const store = await cookies();
    return verifyToken(store.get(SESSION_COOKIE)?.value, secret());
}

export async function assertAdmin(): Promise<AdminSession> {
    const session = await getAdminSession();
    if (!session) throw new Error("NOT_AUTHENTICATED");
    return session;
}

async function setAdminSession(payload: AdminSession): Promise<void> {
    const token = await signToken(payload, secret());
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
    });
}

export async function clearAdminSession(): Promise<void> {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
}

// ─── Bootstrap first admin from env if table is empty ────────
async function ensureBootstrapAdmin(): Promise<void> {
    const supa = getAdminClient();
    const { data, error } = await supa.from("admin_users").select("id").limit(1);
    if (error) {
        log.error("admin.bootstrap.query_failed", { error: error.message });
        return;
    }
    if (data && data.length > 0) return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        log.warn("admin.bootstrap.no_env", {
            hint: "Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the first admin",
        });
        return;
    }
    const { error: insErr } = await supa.from("admin_users").insert({
        email: email.toLowerCase(),
        password_hash: hashPassword(password),
    });
    if (insErr) log.error("admin.bootstrap.insert_failed", { error: insErr.message });
    else log.info("admin.bootstrap.created", { email: email.toLowerCase() });
}

// ─── Login ───────────────────────────────────────────────────
export async function loginAdmin(
    email: string,
    password: string,
    ip = "unknown"
): Promise<{ success: boolean; error?: string }> {
    const t0 = Date.now();
    const normEmail = (email || "").trim().toLowerCase();
    const key = `${normEmail}:${ip}`;

    if (isRateLimited(key)) {
        log.warn("admin.login.rate_limited", { email: normEmail, ip });
        return {
            success: false,
            error: "Too many attempts. Please try again in about 10 minutes.",
        };
    }

    await ensureBootstrapAdmin();
    const supa = getAdminClient();
    const { data: admin } = await supa
        .from("admin_users")
        .select("*")
        .eq("email", normEmail)
        .maybeSingle();

    if (!admin || !verifyPassword(password, admin.password_hash)) {
        recordFailure(key);
        log.warn("admin.login.failed", { email: normEmail, ip });
        return { success: false, error: "Incorrect email or password." };
    }

    clearFailures(key);
    await supa
        .from("admin_users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", admin.id);
    await setAdminSession({
        adminId: admin.id,
        email: admin.email,
        iat: Math.floor(Date.now() / 1000),
    });

    // Direct audit insert here (avoid importing lib/audit → circular dep).
    await supa.from("audit_logs").insert({
        action: "login",
        table_name: "admin_users",
        record_id: admin.id,
        admin_email: admin.email,
        metadata: { ip, durationMs: Date.now() - t0 },
    });
    log.info("admin.login.success", {
        email: admin.email,
        durationMs: Date.now() - t0,
    });
    return { success: true };
}

export async function logoutAdmin(): Promise<void> {
    await clearAdminSession();
}

// ─── Change password (settings page) ─────────────────────────
export async function changeAdminPassword(
    currentPassword: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    const session = await assertAdmin();
    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: "New password must be at least 8 characters." };
    }
    const supa = getAdminClient();
    const { data: admin } = await supa
        .from("admin_users")
        .select("*")
        .eq("id", session.adminId)
        .maybeSingle();
    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
        return { success: false, error: "Current password is incorrect." };
    }
    const { error } = await supa
        .from("admin_users")
        .update({ password_hash: hashPassword(newPassword) })
        .eq("id", admin.id);
    if (error) {
        log.error("admin.password.change_failed", { error: error.message });
        return { success: false, error: "Could not update password. Try again." };
    }
    await supa.from("audit_logs").insert({
        action: "update",
        table_name: "admin_users",
        record_id: admin.id,
        admin_email: admin.email,
        metadata: { field: "password" },
    });
    return { success: true };
}
