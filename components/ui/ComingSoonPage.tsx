"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

interface ComingSoonPageProps {
    title: string;
    description: string;
    launchText?: string;
    showWaitlist?: boolean;
    icon: React.ReactNode;
}

export default function ComingSoonPage({
    title,
    description,
    launchText = "Coming Soon",
    showWaitlist = true,
    icon,
}: ComingSoonPageProps) {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const supabase = createClient();
        await supabase.from("waitlist").insert({ email, created_at: new Date().toISOString() });
        setSubmitted(true);
        setLoading(false);
    }

    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "80px 40px",
                maxWidth: 600,
                margin: "0 auto",
                width: "100%",
            }}
        >
            {/* Icon */}
            <div
                style={{
                    width: 72,
                    height: 72,
                    borderRadius: 18,
                    background: "var(--surface-2)",
                    border: "1.5px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    marginBottom: 24,
                }}
            >
                {icon}
            </div>

            {/* Badge */}
            <span
                style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "4px 12px",
                    borderRadius: 99,
                    background: "rgba(224,156,44,0.12)",
                    color: "var(--gold)",
                    border: "1px solid rgba(224,156,44,0.2)",
                    marginBottom: 16,
                }}
            >
                {launchText}
            </span>

            <h1
                style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 38,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 16,
                    lineHeight: 1.2,
                }}
            >
                {title}
            </h1>
            <p
                style={{
                    color: "var(--text-secondary)",
                    fontSize: 15,
                    lineHeight: 1.7,
                    marginBottom: 36,
                    maxWidth: 480,
                }}
            >
                {description}
            </p>

            {/* Waitlist */}
            {showWaitlist && !submitted ? (
                <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 380 }}>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                        Get notified when this launches
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-base"
                            placeholder="Enter your email"
                            required
                            id="waitlist-email"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                            {loading ? "..." : "Notify Me"}
                        </button>
                    </div>
                </form>
            ) : showWaitlist && submitted ? (
                <div
                    style={{
                        padding: "14px 24px",
                        background: "rgba(43,191,120,0.09)",
                        border: "1px solid rgba(43,191,120,0.2)",
                        borderRadius: 8,
                        color: "var(--green)",
                        fontSize: 14,
                        fontWeight: 500,
                    }}
                >
                    You are on the list. We will notify you when this launches.
                </div>
            ) : null}
        </div>
    );
}
