import type { SupabaseClient } from "@supabase/supabase-js";

export interface Announcement {
    id: string;
    title: string;
    body: string;
    priority: string;
    created_at: string;
    read: boolean;
}

/** Live announcements for the student's batch (RLS filters). */
export async function fetchAnnouncements(
    supabase: SupabaseClient,
    studentId: string
): Promise<Announcement[]> {
    const { data: rows, error } = await supabase
        .from("announcements")
        .select("id, title, body, priority, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

    if (error) {
        // Table may not exist until migration 007
        if (error.code === "42P01" || error.message.includes("does not exist")) return [];
        throw error;
    }

    const ids = (rows || []).map((r) => r.id);
    const readSet = new Set<string>();
    if (ids.length) {
        const { data: reads } = await supabase
            .from("announcement_reads")
            .select("announcement_id")
            .eq("student_id", studentId)
            .in("announcement_id", ids);
        for (const r of reads || []) readSet.add(r.announcement_id);
    }

    return (rows || []).map((r) => ({
        ...r,
        read: readSet.has(r.id),
    }));
}

export async function markAnnouncementRead(
    supabase: SupabaseClient,
    studentId: string,
    announcementId: string
): Promise<void> {
    const { error } = await supabase.from("announcement_reads").upsert(
        { student_id: studentId, announcement_id: announcementId, read_at: new Date().toISOString() },
        { onConflict: "student_id,announcement_id" }
    );
    if (error && !error.message.includes("does not exist")) throw error;
}

export function unreadCount(announcements: Announcement[]): number {
    return announcements.filter((a) => !a.read).length;
}
