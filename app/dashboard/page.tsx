import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/dashboard/StatCard";
import BatchProgress from "@/components/dashboard/BatchProgress";
import ScheduleWidget from "@/components/dashboard/ScheduleWidget";
import { getDaysUntilNEET, SCHEDULE_EVENTS } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Dashboard — BioMonk",
    description: "Your BioMonk student dashboard. Track your test scores, chapter progress, and upcoming schedule.",
};

function ScoreIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    );
}
function BookIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}
function TrophyIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="14.5 17.5 3 6" />
            <path d="M8 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
            <path d="M12 17v4" /><line x1="8" y1="21" x2="16" y2="21" />
            <path d="M7 9h10" />
        </svg>
    );
}
function CalendarIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    );
}
function FileIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    );
}

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Fetch profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*, batch:batches(*)")
        .eq("id", user.id)
        .single();

    const batch = profile?.batch ?? null;

    // Fetch chapters (do not filter by batch_id)
    const { data: chapters } = await supabase
        .from("chapters")
        .select("*")
        .order("order_index");

    // Fetch completed test attempts
    const { data: completedAttempts } = await supabase
        .from("test_attempts")
        .select("*, test:tests(chapter_id, total_marks)")
        .eq("student_id", user.id)
        .eq("is_completed", true)
        .order("submitted_at", { ascending: false });

    // Latest test score
    const latestScore = completedAttempts?.[0]?.score ?? null;
    const prevScore = completedAttempts?.[1]?.score ?? null;
    const scoreDiff = latestScore !== null && prevScore !== null ? latestScore - prevScore : null;

    // Syllabus completed
    const totalChapters = chapters?.length || 0;
    const completedChapterIds: string[] = [];
    if (completedAttempts && chapters) {
        for (const ch of chapters) {
            const hasTest = completedAttempts.some(
                (a: any) => a.test?.chapter_id === ch.id
            );
            if (hasTest) completedChapterIds.push(ch.id);
        }
    }
    const syllabusPercent =
        totalChapters > 0
            ? Math.round((completedChapterIds.length / totalChapters) * 100)
            : 0;

    // Days until NEET
    const daysLeft = getDaysUntilNEET();

    // Recent materials (coming soon placeholder data)
    const { data: recentMaterials } = await supabase
        .from("study_materials")
        .select("*, chapter:chapters(name)")
        .order("created_at", { ascending: false })
        .limit(3);

    return (
        <AppShell
            pageTitle="Dashboard"
            profile={profile}
            batch={batch}
        >
            {/* Greeting */}
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
                    Good day, {profile?.full_name?.split(" ")[0] || "Student"}
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
                    Here is your progress summary for {batch?.name || "your batch"}.
                </p>
            </div>

            {/* Stat cards */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 16,
                    marginBottom: 24,
                }}
            >
                <StatCard
                    label="Biology Score"
                    value={latestScore !== null ? `${latestScore}` : "—"}
                    subtext={latestScore !== null ? "out of 360" : "No tests taken yet"}
                    change={scoreDiff !== null ? `${Math.abs(scoreDiff)} pts` : undefined}
                    changePositive={scoreDiff !== null ? scoreDiff >= 0 : undefined}
                    icon={<ScoreIcon />}
                    accentColor="var(--green)"
                />
                <StatCard
                    label="Syllabus Completed"
                    value={`${syllabusPercent}%`}
                    subtext={`${completedChapterIds.length}/${totalChapters} chapters`}
                    icon={<BookIcon />}
                    accentColor="var(--blue)"
                />
                <StatCard
                    label="Estimated Rank"
                    value={latestScore !== null ? `~${Math.max(1, Math.round((720 - latestScore) / 2))}` : "—"}
                    subtext={latestScore !== null ? "Based on your score" : "Take a test first"}
                    icon={<TrophyIcon />}
                    accentColor="var(--gold)"
                />
                <StatCard
                    label="Days Until NEET"
                    value={daysLeft}
                    subtext="NEET 2026 — May 3"
                    icon={<CalendarIcon />}
                    accentColor="var(--red)"
                />
            </div>

            {/* Mid section: batch progress + schedule */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 24,
                }}
            >
                <BatchProgress
                    batchName={batch?.name || "—"}
                    chapters={chapters || []}
                    completedChapterIds={completedChapterIds}
                />
                <ScheduleWidget events={SCHEDULE_EVENTS} />
            </div>

            {/* Continue Watching */}
            <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 16 }}>
                    Recent Study Materials
                </h3>
                {recentMaterials && recentMaterials.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {recentMaterials.map((m: any) => {
                            const typeColor: Record<string, string> = {
                                notes: "var(--green)",
                                mindmap: "var(--gold)",
                                pyq: "var(--red)",
                                formula_sheet: "var(--blue)",
                            };
                            const typeLabel: Record<string, string> = {
                                notes: "Lecture Notes",
                                mindmap: "Mind Map",
                                pyq: "PYQ Set",
                                formula_sheet: "Formula Sheet",
                            };
                            const color = typeColor[m.type] || "var(--text-secondary)";
                            return (
                                <Link
                                    key={m.id}
                                    href="/materials"
                                    style={{ textDecoration: "none" }}
                                >
                                    <div
                                        style={{
                                            padding: "14px 16px",
                                            background: "var(--surface-2)",
                                            borderRadius: 8,
                                            border: "1px solid var(--border)",
                                            cursor: "pointer",
                                            transition: "border-color 0.15s",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 7,
                                                    background: `${color}18`,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color,
                                                }}
                                            >
                                                <FileIcon />
                                            </div>
                                            <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                {typeLabel[m.type] || m.type}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {m.title}
                                        </p>
                                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                            {m.chapter?.name} · {m.page_count} pages
                                        </p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        style={{
                            padding: "32px",
                            textAlign: "center",
                            background: "var(--surface-2)",
                            borderRadius: 8,
                            border: "1px dashed var(--border)",
                        }}
                    >
                        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                            No study materials yet. Your recent materials will appear here.
                        </p>
                        <Link
                            href="/materials"
                            style={{
                                display: "inline-block",
                                marginTop: 12,
                                fontSize: 13,
                                color: "var(--green)",
                                fontWeight: 500,
                                textDecoration: "none",
                            }}
                        >
                            Browse Materials
                        </Link>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
