// Edge- AND Node-safe admin session primitives.
// Uses Web Crypto (crypto.subtle) so this module can be imported by middleware.
// Do NOT import node:crypto or next/headers here — see lib/admin-auth.ts for those.

export const SESSION_COOKIE = "biomonk_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

export interface AdminSession {
    adminId: string;
    email: string;
    iat: number; // issued-at (unix seconds)
}

// ─── base64url helpers (work in Edge + Node) ─────────────────
function toB64Url(bytes: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(padded);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

// Return a concrete ArrayBuffer (avoids TS's ArrayBufferLike/SharedArrayBuffer
// ambiguity when passing to crypto.subtle as a BufferSource).
function bytes(input: string | Uint8Array): ArrayBuffer {
    const u = typeof input === "string" ? new TextEncoder().encode(input) : input;
    return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        bytes(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

export async function signToken(
    payload: AdminSession,
    secret: string
): Promise<string> {
    const body = toB64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const key = await getHmacKey(secret);
    const sig = await crypto.subtle.sign("HMAC", key, bytes(body));
    return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

export async function verifyToken(
    token: string | undefined | null,
    secret: string
): Promise<AdminSession | null> {
    if (!token || !secret) return null;
    const dot = token.indexOf(".");
    if (dot < 0) return null;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!body || !sig) return null;
    try {
        const key = await getHmacKey(secret);
        const ok = await crypto.subtle.verify(
            "HMAC",
            key,
            bytes(fromB64Url(sig)),
            bytes(body)
        );
        if (!ok) return null;
        const payload = JSON.parse(
            new TextDecoder().decode(fromB64Url(body))
        ) as AdminSession;
        if (
            !payload ||
            typeof payload.iat !== "number" ||
            Date.now() / 1000 - payload.iat > SESSION_MAX_AGE
        ) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

// ─── In-memory rate limit (best-effort across a single instance) ─
// Serverless may reset this between cold starts — a strong password is the
// real defense; this just blunts rapid brute-force within a warm instance.
const WINDOW_MS = 10 * 60 * 1000; // 10 min
const MAX_FAILS = 5;
const failures = new Map<string, { count: number; first: number }>();

export function isRateLimited(key: string): boolean {
    const entry = failures.get(key);
    if (!entry) return false;
    if (Date.now() - entry.first > WINDOW_MS) {
        failures.delete(key);
        return false;
    }
    return entry.count >= MAX_FAILS;
}

export function recordFailure(key: string): void {
    const entry = failures.get(key);
    if (!entry || Date.now() - entry.first > WINDOW_MS) {
        failures.set(key, { count: 1, first: Date.now() });
    } else {
        entry.count += 1;
    }
}

export function clearFailures(key: string): void {
    failures.delete(key);
}
