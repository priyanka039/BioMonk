"use server";

import { headers } from "next/headers";
import { loginAdmin, logoutAdmin } from "@/lib/admin-auth";
import { ok, fail, run, type ActionResult } from "./_helpers";

async function clientIp(): Promise<string> {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return h.get("x-real-ip") || "unknown";
}

export async function adminLogin(
    email: string,
    password: string
): Promise<ActionResult> {
    return run(async () => {
        if (!email || !password) return fail("Email and password are required.");
        const ip = await clientIp();
        const res = await loginAdmin(email, password, ip);
        if (!res.success) return fail(res.error || "Login failed.");
        return ok();
    });
}

export async function adminLogout(): Promise<ActionResult> {
    return run(async () => {
        await logoutAdmin();
        return ok();
    });
}
