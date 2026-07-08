"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "./actions/auth";
import AlertBanner from "@/components/admin/AlertBanner";
import ClientOnly from "@/components/ClientOnly";
import BioMonkLogo from "@/components/BioMonkLogo";

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
        <div className="auth-shell">
            <aside className="auth-brand-panel">
                <BioMonkLogo
                    variant="compact"
                    tone="on-dark"
                    height={44}
                    priority
                    suffix={<span className="brand-badge">Admin</span>}
                />
                <h1>Coach control panel</h1>
                <p>Manage batches, materials, tests, and student access from one place.</p>
            </aside>

            <main className="auth-form-panel">
                <div className="auth-card">
                    <h2>Admin sign in</h2>
                    <p className="auth-subtitle">Sign in to manage your coaching institute</p>

                    <AlertBanner kind="error" message={error} onClose={() => setError("")} />

                    <ClientOnly fallback={<div style={{ minHeight: 220 }} aria-hidden />}>
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
                                className="btn btn-primary"
                                style={{ width: "100%", padding: "12px" }}
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
                    </ClientOnly>
                </div>
            </main>
        </div>
    );
}
