"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Profile, Batch } from "@/lib/types";

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

function BookOpenIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}
function GridIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
    );
}
function VideoIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
    );
}
function ClipboardIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
    );
}
function TrendingIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
        </svg>
    );
}
function MessageIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}
function CalendarIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    );
}
function LogoutIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );
}

const mainNav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: <GridIcon /> },
    { href: "/lectures", label: "Lectures", icon: <VideoIcon /> },
    { href: "/tests", label: "Tests", icon: <ClipboardIcon /> },
    { href: "/materials", label: "Study Material", icon: <BookOpenIcon /> },
];

const insightsNav: NavItem[] = [
    { href: "/progress", label: "Progress", icon: <TrendingIcon /> },
    { href: "/doubts", label: "Doubts", icon: <MessageIcon /> },
    { href: "/schedule", label: "Schedule", icon: <CalendarIcon /> },
];

interface SidebarProps {
    profile: Profile | null;
    batch: Batch | null;
}

function getInitials(name: string) {
    return name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
}

export default function Sidebar({ profile, batch }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    async function handleSignOut() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
    }

    return (
        <aside
            style={{
                width: 228,
                minHeight: "100vh",
                background: "var(--surface)",
                borderRight: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 50,
            }}
        >
            {/* Logo */}
            <div
                style={{
                    padding: "20px 20px 16px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                <div
                    style={{
                        width: 36,
                        height: 36,
                        background: "var(--green)",
                        borderRadius: 9,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10" />
                        <path d="M12 8v4l3 3" />
                        <path d="M20 2c-2 4-6 6-8 8" />
                    </svg>
                </div>
                <span
                    style={{
                        fontFamily: "'Fraunces', serif",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                    }}
                >
                    Bio<span style={{ color: "var(--green)" }}>Monk</span>
                </span>
            </div>

            {/* Nav */}
            <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
                <p
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        padding: "0 8px",
                        marginBottom: 6,
                    }}
                >
                    Main
                </p>
                <ul style={{ listStyle: "none", marginBottom: 24 }}>
                    {mainNav.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`nav-item ${isActive ? "active" : ""}`}
                                    style={{ marginBottom: 2, display: "flex" }}
                                >
                                    {item.icon}
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                <p
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        padding: "0 8px",
                        marginBottom: 6,
                    }}
                >
                    Insights
                </p>
                <ul style={{ listStyle: "none" }}>
                    {insightsNav.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`nav-item ${isActive ? "active" : ""}`}
                                    style={{ marginBottom: 2, display: "flex" }}
                                >
                                    {item.icon}
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Profile card */}
            <div
                style={{
                    padding: "12px 16px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--surface-3)",
                        border: "1.5px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--green)",
                        flexShrink: 0,
                    }}
                >
                    {profile?.full_name ? getInitials(profile.full_name) : "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {profile?.full_name || "Student"}
                    </p>
                    <p
                        style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {batch?.name || "No Batch"}
                    </p>
                </div>
                <button
                    onClick={handleSignOut}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        padding: 4,
                        flexShrink: 0,
                    }}
                    title="Sign out"
                    aria-label="Sign out"
                >
                    <LogoutIcon />
                </button>
            </div>
        </aside>
    );
}
