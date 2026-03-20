import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import MaterialsBrowser from "./MaterialsBrowser";
import AppShell from "@/components/layout/AppShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Study Materials — BioMonk",
    description: "Browse and download NEET Biology study materials including notes, mind maps, PYQ sets, and formula sheets.",
};

export default async function MaterialsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*, batch:batches(*)")
        .eq("id", user.id)
        .single();

    const batch = profile?.batch ?? null;

    // Fetch all chapters (do not filter by batch_id)
    const { data: chapters } = await supabase
        .from("chapters")
        .select("*")
        .order("order_index");

    // Fetch all study materials (no batch-related filtering)
    const { data: materials } = await supabase
        .from("study_materials")
        .select("*, chapter:chapters(name, class_level)")
        .order("created_at", { ascending: false });

    return (
        <AppShell pageTitle="Study Material" profile={profile} batch={batch}>
            <MaterialsBrowser
                chapters={chapters || []}
                materials={materials || []}
            />
        </AppShell>
    );
}
