"use client";

type Kind = "success" | "error" | "info" | "warning";

const STYLES: Record<Kind, { color: string; bg: string; border: string }> = {
    success: { color: "var(--green)", bg: "rgba(43,191,120,0.09)", border: "rgba(43,191,120,0.25)" },
    error: { color: "var(--red)", bg: "rgba(224,82,82,0.08)", border: "rgba(224,82,82,0.25)" },
    warning: { color: "var(--gold)", bg: "rgba(224,156,44,0.09)", border: "rgba(224,156,44,0.25)" },
    info: { color: "var(--blue)", bg: "rgba(74,156,224,0.09)", border: "rgba(74,156,224,0.25)" },
};

export default function AlertBanner({
    kind,
    message,
    onClose,
}: {
    kind: Kind;
    message: string;
    onClose?: () => void;
}) {
    if (!message) return null;
    const s = STYLES[kind];
    return (
        <div
            role="alert"
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                color: s.color,
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 13,
                marginBottom: 16,
            }}
        >
            <span>{message}</span>
            {onClose && (
                <button
                    onClick={onClose}
                    aria-label="Dismiss"
                    style={{ background: "none", border: "none", color: s.color, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                >
                    ×
                </button>
            )}
        </div>
    );
}
