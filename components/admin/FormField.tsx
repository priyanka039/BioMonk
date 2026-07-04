"use client";

import React from "react";

export default function FormField({
    label,
    htmlFor,
    error,
    hint,
    children,
}: {
    label: string;
    htmlFor?: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label
                htmlFor={htmlFor}
                style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </label>
            {children}
            {hint && !error && (
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{hint}</p>
            )}
            {error && (
                <p style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>{error}</p>
            )}
        </div>
    );
}
