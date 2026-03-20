import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AppShell from "@/components/layout/AppShell";
import ComingSoonPage from "@/components/ui/ComingSoonPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Live Classes — BioMonk",
    description: "Live interactive biology classes with Vicky Vaswani — coming soon to BioMonk.",
};

function VideoIcon() {
    return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
    );
}

export default async function LecturesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("profiles").select("*, batch:batches(*)").eq("id", user.id).single();
    const batch = profile?.batch ?? null;

    return (
        <AppShell pageTitle="Live Classes" profile={profile} batch={batch}>
            <ComingSoonPage
                title="Live Classes"
                description="Interactive live sessions with Vicky Vaswani are coming soon. Enrolled students will be notified when the first class is scheduled. Sessions will include live doubt clearing, concept walkthroughs, and exam strategies."
                launchText="Launching May 2025"
                icon={<VideoIcon />}
            />
        </AppShell>
    );
}
