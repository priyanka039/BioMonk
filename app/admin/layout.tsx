"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [auth, setAuth] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (sessionStorage.getItem("admin_authenticated") === "true") {
            setAuth(true);
        } else {
            if (pathname !== "/admin") {
                router.push("/admin");
            }
        }
    }, [pathname, router]);

    const handleLogout = () => {
        sessionStorage.removeItem("admin_authenticated");
        router.push("/admin");
    };

    if (!auth && pathname !== "/admin") return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
            {auth && (
                <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                    <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
                        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: "var(--text-primary)" }}>Bio<span style={{ color: "var(--green)" }}>Monk</span> Admin</h1>
                        <nav style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                            <Link href="/admin/dashboard" style={{ color: pathname === "/admin/dashboard" ? "var(--green)" : "var(--text-primary)", textDecoration: "none", fontWeight: 600 }}>Dashboard</Link>
                            <Link href="/admin/materials" style={{ color: pathname === "/admin/materials" ? "var(--green)" : "var(--text-primary)", textDecoration: "none", fontWeight: 600 }}>Materials</Link>
                            <Link href="/admin/tests" style={{ color: pathname === "/admin/tests" ? "var(--green)" : "var(--text-primary)", textDecoration: "none", fontWeight: 600 }}>Tests</Link>
                            <Link href="/admin/students" style={{ color: pathname === "/admin/students" ? "var(--green)" : "var(--text-primary)", textDecoration: "none", fontWeight: 600 }}>Students</Link>
                        </nav>
                    </div>
                    <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px" }}>Logout</button>
                </header>
            )}
            <main style={{ flex: 1, padding: "32px 16px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
                {children}
            </main>
        </div>
    );
}
