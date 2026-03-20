"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

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
            {/* Card */}
            <div
                style={{
                    width: "100%",
                    maxWidth: 400,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 48,
                    boxShadow: "var(--shadow)",
                }}
            >
                {/* Logo mark */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            background: "var(--green)",
                            borderRadius: 11,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10" />
                            <path d="M12 8v4l3 3" />
                            <path d="M20 2c-2 4-6 6-8 8" />
                        </svg>
                    </div>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                        Bio<span style={{ color: "var(--green)" }}>Monk</span>
                    </span>
                </div>

                {/* Heading */}
                <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                    Welcome back
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>
                    Sign in to continue your NEET Biology preparation
                </p>

                <form onSubmit={handleSubmit}>
                    {/* Email */}
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

                    {/* Password */}
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

                    {/* Error */}
                    {error && (
                        <p
                            style={{
                                color: "var(--red)",
                                fontSize: 12.5,
                                marginBottom: 12,
                                padding: "8px 12px",
                                background: "rgba(224,82,82,0.08)",
                                borderRadius: 6,
                                border: "1px solid rgba(224,82,82,0.2)",
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
                            marginTop: 8,
                            transition: "opacity 0.15s",
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

                <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                    Access is by invitation only. Contact your batch coordinator if you need help.
                </p>
            </div>
        </div>
    );
}
