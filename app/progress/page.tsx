import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AppShell from "@/components/layout/AppShell";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Progress — BioMonk",
    description: "Track your NEET Biology test scores, chapter accuracy, and study progress.",
};

export default async function ProgressPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*, batch:batches(*)")
        .eq("id", user.id)
        .single();

    const batch = profile?.batch ?? null;

    // Last 6 completed attempts with test info
    const { data: attempts } = await supabase
        .from("test_attempts")
        .select("*, test:tests(title, total_marks, chapter_id, type)")
        .eq("student_id", user.id)
        .eq("is_completed", true)
        .order("submitted_at", { ascending: false })
        .limit(6);

    const sortedAttempts = [...(attempts || [])].reverse(); // oldest to newest for chart

    // Chapter-wise accuracy
    const { data: allAttempts } = await supabase
        .from("test_attempts")
        .select("id, test:tests(chapter_id, total_marks, marks_correct, marks_wrong)")
        .eq("student_id", user.id)
        .eq("is_completed", true);

    // For each attempt, get the responses
    const attemptsWithData = attempts || [];
    const maxScore = 360; // Full NEET biology score

    // Chart bars - normalize to percentage
    const chartBars = sortedAttempts.map((a: any, i: number) => ({
        label: new Date(a.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        score: a.score ?? 0,
        total: a.test?.total_marks || 360,
        pct: Math.round(((a.score ?? 0) / (a.test?.total_marks || 360)) * 100),
        isHighlight: i === sortedAttempts.length - 1,
    }));

    const maxPct = Math.max(...chartBars.map((b) => b.pct), 1);

    return (
        <AppShell pageTitle="Progress" profile={profile} batch={batch}>
            {/* Score trend */}
            <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 6 }}>
                    Score Trend
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
                    Your last {sortedAttempts.length} test scores
                </p>

                {sortedAttempts.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", background: "var(--surface-2)", borderRadius: 8 }}>
                        <p style={{ color: "var(--text-muted)" }}>No completed tests yet. Take your first test to see your progress here.</p>
                    </div>
                ) : (
                    <div>
                        {/* CSS bar chart */}
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 160, paddingBottom: 0 }}>
                            {chartBars.map((bar, i) => (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                        {bar.pct}%
                                    </span>
                                    <div
                                        style={{
                                            width: "100%",
                                            height: `${Math.round((bar.pct / maxPct) * 140)}px`,
                                            borderRadius: "4px 4px 0 0",
                                            background: bar.isHighlight ? "var(--green)" : "var(--surface-3)",
                                            transition: "height 0.5s ease",
                                            position: "relative",
                                        }}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Labels */}
                        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                            {chartBars.map((bar, i) => (
                                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{bar.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Score values */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 20 }}>
                            {sortedAttempts.map((a: any, i: number) => (
                                <div
                                    key={a.id}
                                    style={{
                                        padding: "10px 14px",
                                        background: "var(--surface-2)",
                                        borderRadius: 8,
                                        border: i === sortedAttempts.length - 1 ? "1px solid rgba(43,191,120,0.3)" : "1px solid var(--border)",
                                    }}
                                >
                                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: i === sortedAttempts.length - 1 ? "var(--green)" : "var(--text-primary)" }}>
                                        {a.score ?? 0}
                                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Outfit', sans-serif", fontWeight: 400 }}>
                                            /{a.test?.total_marks || "—"}
                                        </span>
                                    </p>
                                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {a.test?.title || "Test"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Overall stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                {[
                    {
                        label: "Tests Completed",
                        value: attemptsWithData.length,
                        color: "var(--green)",
                    },
                    {
                        label: "Best Score",
                        value: attemptsWithData.length > 0
                            ? `${Math.max(...attemptsWithData.map((a: any) => a.score ?? 0))}`
                            : "—",
                        color: "var(--gold)",
                    },
                    {
                        label: "Average Score",
                        value: attemptsWithData.length > 0
                            ? Math.round(attemptsWithData.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / attemptsWithData.length)
                            : "—",
                        color: "var(--blue)",
                    },
                ].map((s) => (
                    <div key={s.label} className="card" style={{ padding: "20px 24px" }}>
                        <p className="stat-number" style={{ fontSize: 36, color: s.color }}>
                            {s.value}
                        </p>
                        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Chapter-wise breakdown */}
            <div className="card" style={{ padding: "24px 28px" }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginBottom: 6 }}>
                    Recent Test Breakdown
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
                    Performance summary from your recent tests
                </p>

                {attemptsWithData.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", background: "var(--surface-2)", borderRadius: 8 }}>
                        <p style={{ color: "var(--text-muted)" }}>Complete some tests to see your detailed performance breakdown.</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {attemptsWithData.slice(0, 6).map((a: any) => {
                            const pct = a.test?.total_marks
                                ? Math.round(((a.score ?? 0) / a.test.total_marks) * 100)
                                : 0;
                            const color: "green" | "gold" | "red" = pct >= 80 ? "green" : pct >= 60 ? "gold" : "red";
                            return (
                                <div key={a.id}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                        <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                                            {a.test?.title || "Test"}
                                        </span>
                                        <span style={{ fontSize: 12, color: `var(--${color})`, fontWeight: 600 }}>
                                            {a.score ?? 0}/{a.test?.total_marks || "—"} ({pct}%)
                                        </span>
                                    </div>
                                    <ProgressBar value={pct} color={color} height={6} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
