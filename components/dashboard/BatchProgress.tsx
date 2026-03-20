import ProgressBar from "@/components/ui/ProgressBar";
import { Chapter } from "@/lib/types";
import { MENTOR_NAME } from "@/lib/config";

interface BatchProgressProps {
    batchName: string;
    chapters: Chapter[];
    completedChapterIds: string[];
}

function LockIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}
function CheckIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export default function BatchProgress({ batchName, chapters, completedChapterIds }: BatchProgressProps) {
    const total = chapters.length;
    const completed = completedChapterIds.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="card" style={{ padding: 24, height: "100%" }}>
            <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Active Batch
                </p>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: "var(--text-primary)" }}>
                    {batchName || "—"}
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Mentor: {MENTOR_NAME}
                </p>
            </div>

            {/* Overall progress */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Overall Progress</span>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: "var(--green)" }}>
                        {pct}%
                    </span>
                </div>
                <ProgressBar value={pct} color="green" height={8} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    {completed} of {total} chapters covered
                </p>
            </div>

            {/* Chapter list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {chapters.slice(0, 8).map((ch) => {
                    const isCompleted = completedChapterIds.includes(ch.id);
                    const isLocked = ch.is_locked;
                    return (
                        <div
                            key={ch.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "7px 10px",
                                borderRadius: 6,
                                background: "var(--surface-2)",
                            }}
                        >
                            <div
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    background: isLocked
                                        ? "var(--surface-3)"
                                        : isCompleted
                                            ? "rgba(43,191,120,0.15)"
                                            : "rgba(74,156,224,0.15)",
                                    color: isLocked
                                        ? "var(--text-muted)"
                                        : isCompleted
                                            ? "var(--green)"
                                            : "var(--blue)",
                                }}
                            >
                                {isLocked ? <LockIcon /> : isCompleted ? <CheckIcon /> : (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                    </svg>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12.5, color: isLocked ? "var(--text-muted)" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {ch.name}
                                </p>
                            </div>
                            <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                                Class {ch.class_level}
                            </span>
                        </div>
                    );
                })}
                {chapters.length > 8 && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
                        +{chapters.length - 8} more chapters
                    </p>
                )}
            </div>
        </div>
    );
}
