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

    // Fetch chapters — exclude locked (coach controls visibility per batch)
    const { data: chaptersRaw } = await supabase
        .from("chapters")
        .select("*")
        .eq("is_locked", false)
        .order("order_index");

    const chapters = chaptersRaw || [];

    // Fetch study materials for unlocked chapters only
    const { data: materialsRaw } = await supabase
        .from("study_materials")
        .select("*, chapter:chapters(name, class_level, is_locked)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

    const materials = (materialsRaw || []).filter((m) => {
        const ch = Array.isArray(m.chapter) ? m.chapter[0] : m.chapter;
        return !ch?.is_locked;
    });

    return (
        <AppShell pageTitle="Study Material" profile={profile} batch={batch}>
            <MaterialsBrowser
                chapters={chapters}
                materials={materials}
            />
        </AppShell>
    );
}
