"use client";

import { useEffect, useState } from "react";

export default function QuestionMediaImage({
    path,
    alt,
    maxHeight = 280,
}: {
    path: string | null | undefined;
    alt: string;
    maxHeight?: number;
}) {
    const [src, setSrc] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setSrc(null);
        setFailed(false);
        if (!path) return;

        (async () => {
            try {
                const res = await fetch(
                    `/api/storage/resolve-path?path=${encodeURIComponent(path)}&expiresIn=3600`
                );
                const json = await res.json();
                if (!cancelled) {
                    if (res.ok && json.signedUrl) setSrc(json.signedUrl);
                    else setFailed(true);
                }
            } catch {
                if (!cancelled) setFailed(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [path]);

    if (!path) return null;
    if (failed) {
        return (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Image unavailable
            </p>
        );
    }
    if (!src) {
        return (
            <div
                className="skeleton"
                style={{ height: 120, width: "100%", marginTop: 10, borderRadius: 8 }}
                aria-hidden
            />
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            style={{
                display: "block",
                maxWidth: "100%",
                maxHeight,
                width: "auto",
                height: "auto",
                marginTop: 10,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "#fff",
            }}
        />
    );
}
