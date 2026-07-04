"use client";

import React, { useState } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface SubmitButtonProps {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
    children: React.ReactNode;
    variant?: Variant;
    type?: "button" | "submit";
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}

// Button that disables itself while its async handler runs — kills the
// double-click / racing-request class of bugs across every mutation.
export default function SubmitButton({
    onClick,
    children,
    variant = "primary",
    type = "button",
    disabled = false,
    className = "",
    style,
    title,
}: SubmitButtonProps) {
    const [pending, setPending] = useState(false);

    async function handle(e: React.MouseEvent<HTMLButtonElement>) {
        if (pending || disabled) return;
        if (!onClick) return;
        setPending(true);
        try {
            await onClick(e);
        } finally {
            setPending(false);
        }
    }

    return (
        <button
            type={type}
            className={`btn btn-${variant} ${className}`}
            style={style}
            title={title}
            disabled={disabled || pending}
            onClick={onClick ? handle : undefined}
        >
            {pending && (
                <svg
                    className="animate-spin"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
            )}
            {children}
        </button>
    );
}
