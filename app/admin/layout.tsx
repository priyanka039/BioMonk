import { getAdminSession } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getAdminSession();

    // Unauthenticated: only the login page (/admin) is reachable — middleware
    // redirects every other /admin route here. Render it bare (no shell).
    if (!session) return <>{children}</>;

    return <AdminShell email={session.email}>{children}</AdminShell>;
}
