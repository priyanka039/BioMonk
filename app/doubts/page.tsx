import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AppShell from "@/components/layout/AppShell";
import ComingSoonPage from "@/components/ui/ComingSoonPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Doubts — BioMonk",
    description: "Ask and resolve your NEET Biology doubts — coming soon to BioMonk.",
};

function MessageIcon() {
    return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

export default async function DoubtsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("profiles").select("*, batch:batches(*)").eq("id", user.id).single();
    const batch = profile?.batch ?? null;

    return (
        <AppShell pageTitle="Doubts" profile={profile} batch={batch}>
            <ComingSoonPage
                title="Doubt Resolution"
                description="A dedicated space to post your biology questions and get answers from mentors and peers. Text questions, image uploads, and threaded discussions are being built for this feature."
                launchText="Coming Soon"
                icon={<MessageIcon />}
            />
        </AppShell>
    );
}
