"use client";

import { useState, useEffect, useRef } from "react";
import { formatDate } from "@/lib/format";
import {
    getStudentAnnouncements,
    markAnnouncementRead,
} from "@/app/actions/student-announcements";
import type { Announcement } from "@/lib/announcements";

function BellIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Announcement[]>([]);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getStudentAnnouncements().then(setItems).catch(() => setItems([]));
    }, []);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        if (open) document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    const unread = items.filter((a) => !a.read).length;

    async function onRead(id: string) {
        await markAnnouncementRead(id);
        setItems((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    }

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: 8,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                }}
                aria-label="Notifications"
            >
                <BellIcon />
                {unread > 0 && (
                    <span
                        style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            minWidth: 16,
                            height: 16,
                            borderRadius: 99,
                            background: "var(--red)",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 4px",
                        }}
                    >
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="card"
                    style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 8px)",
                        width: 320,
                        maxHeight: 400,
                        overflowY: "auto",
                        zIndex: 50,
                        padding: 0,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                    }}
                >
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13 }}>
                        Notifications
                    </div>
                    {items.length === 0 ? (
                        <p style={{ padding: 24, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                            No announcements yet.
                        </p>
                    ) : (
                        <ul style={{ listStyle: "none" }}>
                            {items.map((a) => (
                                <li
                                    key={a.id}
                                    style={{
                                        padding: "12px 16px",
                                        borderTop: "1px solid var(--border)",
                                        background: a.read ? "transparent" : "rgba(43,191,120,0.06)",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => onRead(a.id)}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</span>
                                        {a.priority === "high" && (
                                            <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 600 }}>IMPORTANT</span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.45 }}>{a.body}</p>
                                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{formatDate(a.created_at)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
