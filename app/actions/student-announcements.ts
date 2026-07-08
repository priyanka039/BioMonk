"use server";

import { createClient } from "@/lib/supabase-server";
import {
    fetchAnnouncements,
    markAnnouncementRead as markRead,
    type Announcement,
} from "@/lib/announcements";

export async function getStudentAnnouncements(): Promise<Announcement[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    try {
        return await fetchAnnouncements(supabase, user.id);
    } catch {
        return [];
    }
}

export async function markAnnouncementRead(announcementId: string): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await markRead(supabase, user.id, announcementId);
}
