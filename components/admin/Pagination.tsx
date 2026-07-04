"use client";

import { PAGE_SIZE } from "@/lib/pagination";

export default function Pagination({
    page,
    total,
    onPage,
}: {
    page: number;
    total: number;
    onPage: (p: number) => void;
}) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (total === 0) return null;
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                fontSize: 13,
                color: "var(--text-secondary)",
            }}
        >
            <span>
                {start}–{end} of {total}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
                <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 12px", fontSize: 13 }}
                    disabled={page <= 1}
                    onClick={() => onPage(page - 1)}
                >
                    Prev
                </button>
                <span style={{ padding: "6px 4px" }}>
                    {page} / {pages}
                </span>
                <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 12px", fontSize: 13 }}
                    disabled={page >= pages}
                    onClick={() => onPage(page + 1)}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
