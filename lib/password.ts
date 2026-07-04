import crypto from "node:crypto";

// scrypt password hashing — no external dependency (no bcrypt).
// Stored format: "<saltHex>:<hashHex>".

export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = (stored || "").split(":");
    if (!salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const hashBuf = Buffer.from(hash, "hex");
    if (hashBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(hashBuf, derived);
}
