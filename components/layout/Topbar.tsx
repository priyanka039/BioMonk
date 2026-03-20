"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function SearchIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
    );
}
function BellIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

interface TopbarProps {
    pageTitle: string;
    onSearch?: (query: string) => void;
}

export default function Topbar({ pageTitle, onSearch }: TopbarProps) {
    const [query, setQuery] = useState("");
    const router = useRouter();

    function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
        setQuery(e.target.value);
        onSearch?.(e.target.value);
    }

    return (
        <header
            style={{
                height: 58,
                background: "var(--surface)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
                gap: 16,
                position: "sticky",
                top: 0,
                zIndex: 40,
            }}
        >
            {/* Page title */}
            <h1
                style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 17,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    minWidth: 120,
                }}
            >
                {pageTitle}
            </h1>

            {/* Search */}
            <div style={{ flex: 1, maxWidth: 400, margin: "0 auto" }}>
                <div style={{ position: "relative" }}>
                    <span
                        style={{
                            position: "absolute",
                            left: 11,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-muted)",
                            pointerEvents: "none",
                        }}
                    >
                        <SearchIcon />
                    </span>
                    <input
                        type="search"
                        placeholder="Search materials, tests..."
                        value={query}
                        onChange={handleSearch}
                        className="input-base"
                        style={{ paddingLeft: 36, fontSize: 13 }}
                        aria-label="Search"
                        id="topbar-search"
                    />
                </div>
            </div>

            {/* Notification bell */}
            <button
                style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: 8,
                    borderRadius: 6,
                    transition: "background 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                onMouseEnter={(e) =>
                ((e.target as HTMLElement).closest("button")!.style.background =
                    "var(--surface-2)")
                }
                onMouseLeave={(e) =>
                ((e.target as HTMLElement).closest("button")!.style.background =
                    "none")
                }
                aria-label="Notifications"
                id="notification-bell"
            >
                <BellIcon />
            </button>
        </header>
    );
}
