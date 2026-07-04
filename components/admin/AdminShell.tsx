"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/app/admin/actions/auth";

const NAV = [
    { href: "/admin/materials", label: "Materials" },
    { href: "/admin/tests", label: "Tests" },
    { href: "/admin/students", label: "Students" },
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
                style={{
                    background: "var(--surface)",
                    borderBottom: "1px solid var(--border)",
                    padding: "14px 24px",
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
                    <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 19 }}>
                        Bio<span style={{ color: "var(--green)" }}>Monk</span>{" "}
                        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Admin</span>
                    </h1>
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
                    <button
                        onClick={handleLogout}
                        className="btn btn-ghost"
                        style={{ fontSize: 13, padding: "6px 12px" }}
                    >
                        Logout
                    </button>
                </div>
            </header>
            <main style={{ flex: 1, padding: "28px 20px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
                {children}
            </main>
        </div>
    );
}
