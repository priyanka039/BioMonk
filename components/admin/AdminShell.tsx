"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/app/admin/actions/auth";
import BioMonkLogo from "@/components/BioMonkLogo";
import ClientOnly from "@/components/ClientOnly";

const NAV = [
    { href: "/admin/materials", label: "Materials" },
    { href: "/admin/tests", label: "Tests" },
    { href: "/admin/students", label: "Students" },
    { href: "/admin/batches", label: "Batches" },
    { href: "/admin/chapters", label: "Chapters" },
    { href: "/admin/announcements", label: "Announcements" },
    { href: "/admin/activity", label: "Activity" },
    { href: "/admin/archive", label: "Archive" },
    { href: "/admin/settings", label: "Settings" },
];

export default function AdminShell({
    email,
    children,
}: {
    email: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    async function handleLogout() {
        await adminLogout();
        router.replace("/admin");
        router.refresh();
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
            <header
                className="admin-bar"
                style={{
                    background: "var(--surface)",
                    borderBottom: "1px solid var(--border-soft)",
                    padding: "12px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 16,
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                }}
            >
                <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
                    <BioMonkLogo
                        variant="compact"
                        tone="on-dark"
                        height={32}
                        suffix={<span className="brand-badge">Admin</span>}
                    />
                    <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {NAV.map((item) => {
                            const active =
                                pathname === item.href || pathname.startsWith(item.href + "/");
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-item ${active ? "active" : ""}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{email}</span>
                    <ClientOnly fallback={<div style={{ width: 72, height: 34 }} aria-hidden />}>
                        <button
                            onClick={handleLogout}
                            className="btn btn-ghost"
                            style={{ fontSize: 13, padding: "6px 12px" }}
                        >
                            Logout
                        </button>
                    </ClientOnly>
                </div>
            </header>
            <main style={{ flex: 1, padding: "28px 20px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
                <ClientOnly fallback={<div style={{ minHeight: 480 }} aria-busy="true" aria-label="Loading" />}>
                    {children}
                </ClientOnly>
            </main>
        </div>
    );
}
