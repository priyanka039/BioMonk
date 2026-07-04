"use server";

import { changeAdminPassword as changePw } from "@/lib/admin-auth";
import { ok, fail, run, type ActionResult } from "./_helpers";

export async function changeAdminPassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
): Promise<ActionResult> {
    return run(async () => {
        if (!currentPassword || !newPassword) {
            return fail("All fields are required.");
        }
        if (newPassword !== confirmPassword) {
            return fail("New password and confirmation do not match.");
        }
        const res = await changePw(currentPassword, newPassword);
        if (!res.success) return fail(res.error || "Could not change password.");
        return ok();
    });
}
