"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ClientOnly from "@/components/ClientOnly";
import BioMonkLogo from "@/components/BioMonkLogo";

function EyeIcon({ show }: { show: boolean }) {
    return show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const supabase = createClient();
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (authError) {
                setError(
                    authError.message === "Invalid login credentials"
                        ? "Incorrect email or password. Please try again."
                        : authError.message
                );
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-shell">
            <aside className="auth-brand-panel">
                <BioMonkLogo variant="compact" tone="on-dark" height={52} priority />
                <h1>Master NEET Biology with clarity</h1>
                <p>
                    Structured study materials, timed tests, and progress tracking — built for serious aspirants.
                </p>
            </aside>

            <main className="auth-form-panel">
                <div className="auth-card">
                    <h2>Welcome back</h2>
                    <p className="auth-subtitle">Sign in to continue your preparation</p>

                    <ClientOnly fallback={<div style={{ minHeight: 280 }} aria-hidden />}>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 14 }}>
                                <label
                                    htmlFor="login-email"
                                    style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}
                                >
                                    Email address
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-base"
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>

                            <div style={{ marginBottom: 8 }}>
                                <label
                                    htmlFor="login-password"
                                    style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}
                                >
                                    Password
                                </label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        id="login-password"
                                        type={showPass ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input-base"
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(!showPass)}
                                        style={{
                                            position: "absolute",
                                            right: 12,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--text-muted)",
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                        aria-label={showPass ? "Hide password" : "Show password"}
                                    >
                                        <EyeIcon show={showPass} />
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p
                                    style={{
                                        color: "var(--red)",
                                        fontSize: 12.5,
                                        marginBottom: 12,
                                        padding: "8px 12px",
                                        background: "rgba(217, 79, 79, 0.1)",
                                        borderRadius: 8,
                                        border: "1px solid rgba(217, 79, 79, 0.22)",
                                    }}
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                id="login-submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ width: "100%", marginTop: 8, padding: "12px" }}
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

                    <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                        Access is by invitation only. Contact your batch coordinator if you need help.
                    </p>
                </div>
            </main>
        </div>
    );
}
