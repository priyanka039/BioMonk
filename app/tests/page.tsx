import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AppShell from "@/components/layout/AppShell";
import TestsClient from "./TestsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Tests — BioMonk",
    description: "Access your NEET Biology chapter tests, full mocks, and daily practice problems.",
};

export default async function TestsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*, batch:batches(*)")
        .eq("id", user.id)
        .single();

    const batch = profile?.batch ?? null;

    // Fetch all active tests (do not filter by batch_id so newly added DPPs show up)
    const { data: tests } = await supabase
        .from("tests")
        .select("*, chapter:chapters(*)")
        .eq("is_active", true)
        .order("scheduled_at", { ascending: false, nullsFirst: false });

    // Fetch student's attempts
    const { data: attempts } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("student_id", user.id);

    return (
        <AppShell pageTitle="Tests" profile={profile} batch={batch}>
            <TestsClient
                tests={tests || []}
                attempts={attempts || []}
            />
        </AppShell>
    );
}
