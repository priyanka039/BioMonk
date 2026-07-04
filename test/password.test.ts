import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing (scrypt)", () => {
    it("verifies the correct password", () => {
        const stored = hashPassword("s3cret-passw0rd");
        expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
        expect(verifyPassword("s3cret-passw0rd", stored)).toBe(true);
    });

    it("rejects an incorrect password", () => {
        const stored = hashPassword("right-password");
        expect(verifyPassword("wrong-password", stored)).toBe(false);
    });

    it("rejects malformed stored hashes", () => {
        expect(verifyPassword("x", "")).toBe(false);
        expect(verifyPassword("x", "no-colon-here")).toBe(false);
        expect(verifyPassword("x", ":onlyhash")).toBe(false);
    });

    it("uses a random salt (same password → different stored value)", () => {
        expect(hashPassword("same")).not.toBe(hashPassword("same"));
    });
});
