"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "./actions/auth";
import AlertBanner from "@/components/admin/AlertBanner";

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError("");
        setLoading(true);
        try {
            const res = await adminLogin(email, password);
            if (!res.success) {
                setError(res.error);
                setLoading(false);
                return;
            }
            router.replace("/admin/materials");
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
            setLoading(false);
        }
    }

    return (
        <div
            className="grid-bg"
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 400,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 44,
                    boxShadow: "var(--shadow)",
                }}
            >
                <div style={{ marginBottom: 28 }}>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700 }}>
                        Bio<span style={{ color: "var(--green)" }}>Monk</span>{" "}
                        <span style={{ color: "var(--text-muted)", fontSize: 15 }}>Admin</span>
                    </span>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                        Sign in to manage materials, tests, and students.
                    </p>
                </div>

                <AlertBanner kind="error" message={error} onClose={() => setError("")} />

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 14 }}>
                        <label
                            htmlFor="admin-email"
                            style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}
                        >
                            Email address
                        </label>
                        <input
                            id="admin-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-base"
                            placeholder="you@example.com"
                            required
                            autoComplete="username"
                            autoFocus
                        />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label
                            htmlFor="admin-password"
                            style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}
                        >
                            Password
                        </label>
                        <input
                            id="admin-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-base"
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: "100%",
                            background: "var(--green)",
                            border: "none",
                            borderRadius: "var(--btn-radius)",
                            color: "#fff",
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            padding: "12px",
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.7 : 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                                Signing in...
                            </>
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
