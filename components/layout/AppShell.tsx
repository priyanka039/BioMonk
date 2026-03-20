import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Profile, Batch } from "@/lib/types";

interface AppShellProps {
    children: React.ReactNode;
    pageTitle: string;
    profile: Profile | null;
    batch: Batch | null;
    onSearch?: (query: string) => void;
}

export default function AppShell({
    children,
    pageTitle,
    profile,
    batch,
}: AppShellProps) {
    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar profile={profile} batch={batch} />
            <div
                style={{
                    marginLeft: 228,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100vh",
                }}
            >
                <Topbar pageTitle={pageTitle} />
                <main
                    style={{
                        flex: 1,
                        padding: "28px 28px",
                        maxWidth: 1280,
                        width: "100%",
                    }}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
