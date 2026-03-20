import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AppShell from "@/components/layout/AppShell";
import ComingSoonPage from "@/components/ui/ComingSoonPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Schedule — BioMonk",
    description: "Your personalized NEET preparation schedule — coming soon to BioMonk.",
};

function CalendarIcon() {
    return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    );
}

export default async function SchedulePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("profiles").select("*, batch:batches(*)").eq("id", user.id).single();
    const batch = profile?.batch ?? null;

    return (
        <AppShell pageTitle="Schedule" profile={profile} batch={batch}>
            <ComingSoonPage
                title="Study Schedule"
                description="A personalized day-by-day NEET preparation schedule tailored to your batch. Track daily targets, revision plans, and upcoming test dates with live calendar integration."
                launchText="Coming Soon"
                icon={<CalendarIcon />}
            />
        </AppShell>
    );
}
