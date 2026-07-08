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
import NotificationBell from "./NotificationBell";

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
                background: "rgba(28, 15, 58, 0.72)",
                backdropFilter: "blur(12px)",
                borderBottom: "1px solid var(--border-soft)",
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
                gap: 16,
                position: "sticky",
                top: 0,
                zIndex: 40,
            }}
        >
            <h1
                style={{
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

            <NotificationBell />
        </header>
    );
}
