import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase-server";
import { fetchErrorBookEntries, isErrorBookTableReady } from "@/lib/error-book";
import type { ErrorBookEntryWithRelations } from "@/lib/error-book-types";
import ErrorBookClient from "./ErrorBookClient";

export const metadata: Metadata = {
    title: "Error Book — BioMonk",
    description: "Review questions you answered incorrectly and track your improvement.",
};

export default async function ErrorBookPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*, batch:batches(*)")
        .eq("id", user.id)
        .single();

    const batch = profile?.batch ?? null;

    let entries: ErrorBookEntryWithRelations[] = [];
    let persistEnabled = false;
    try {
        persistEnabled = await isErrorBookTableReady(supabase);
        entries = await fetchErrorBookEntries(supabase, user.id, "all");
    } catch (err) {
        console.error("Failed to load error book:", err);
    }

    return (
        <AppShell pageTitle="Error Book" profile={profile} batch={batch}>
            <ErrorBookClient entries={entries} persistEnabled={persistEnabled} />
        </AppShell>
    );
}
