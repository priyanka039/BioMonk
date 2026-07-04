import { describe, it, expect } from "vitest";
import {
    signToken,
    verifyToken,
    isRateLimited,
    recordFailure,
    clearFailures,
    SESSION_MAX_AGE,
    type AdminSession,
} from "@/lib/admin-session";

const SECRET = "test-secret-abcdefghijklmnopqrstuvwxyz-0123456789";

function session(overrides: Partial<AdminSession> = {}): AdminSession {
    return { adminId: "admin-1", email: "coach@biomonk.com", iat: Math.floor(Date.now() / 1000), ...overrides };
}

describe("admin session tokens", () => {
    it("signs and verifies a valid token", async () => {
        const token = await signToken(session(), SECRET);
        const out = await verifyToken(token, SECRET);
        expect(out?.email).toBe("coach@biomonk.com");
        expect(out?.adminId).toBe("admin-1");
    });

    it("rejects a tampered token", async () => {
        const token = await signToken(session(), SECRET);
        const flip = token[5] === "A" ? "B" : "A";
        const tampered = token.slice(0, 5) + flip + token.slice(6);
        expect(await verifyToken(tampered, SECRET)).toBeNull();
    });

    it("rejects a token signed with a different secret", async () => {
        const token = await signToken(session(), SECRET);
        expect(await verifyToken(token, "some-other-secret")).toBeNull();
    });

    it("rejects an expired token", async () => {
        const old = Math.floor(Date.now() / 1000) - (SESSION_MAX_AGE + 60);
        const token = await signToken(session({ iat: old }), SECRET);
        expect(await verifyToken(token, SECRET)).toBeNull();
    });

    it("rejects empty / garbage input", async () => {
        expect(await verifyToken(undefined, SECRET)).toBeNull();
        expect(await verifyToken("", SECRET)).toBeNull();
        expect(await verifyToken("not-a-token", SECRET)).toBeNull();
        expect(await verifyToken("a.b.c", SECRET)).toBeNull();
    });
});

describe("login rate limiting", () => {
    it("blocks after 5 failures within the window and clears on success", () => {
        const key = `rl-${Math.random()}`;
        for (let i = 0; i < 5; i++) {
            expect(isRateLimited(key)).toBe(false);
            recordFailure(key);
        }
        expect(isRateLimited(key)).toBe(true);
        clearFailures(key);
        expect(isRateLimited(key)).toBe(false);
    });
});
