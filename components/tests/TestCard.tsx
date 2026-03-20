import Link from "next/link";
import { Test, TestAttempt } from "@/lib/types";
import Tag from "@/components/ui/Tag";
import ProgressBar from "@/components/ui/ProgressBar";

interface TestCardProps {
    test: Test;
    attempt?: TestAttempt | null;
}

function ClockIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
function LockIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

const TYPE_LABEL: Record<string, string> = {
    chapter_test: "Chapter Test",
    full_mock: "Full Mock",
    dpp: "DPP",
};

const TYPE_TAG: Record<string, "green" | "blue" | "gold"> = {
    chapter_test: "green",
    full_mock: "blue",
    dpp: "gold",
};

const SUBJECT_LABEL: Record<string, string> = {
    biology: "Biology",
    chemistry: "Chemistry",
    physics: "Physics",
};

const SUBJECT_TAG: Record<string, "green" | "blue" | "gold"> = {
    biology: "green",
    chemistry: "blue",
    physics: "gold",
};

export default function TestCard({ test, attempt }: TestCardProps) {
    const isLocked = !test.is_active;
    const isCompleted = attempt?.is_completed;
    const isInProgress = attempt && !attempt.is_completed;
    const score = attempt?.score ?? null;
    const pct = isCompleted && score !== null ? Math.round((score / test.total_marks) * 100) : 0;

    const scoreColor =
        pct >= 80 ? "green" : pct >= 60 ? "gold" : "red";

    return (
        <div
            className="card"
            style={{
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                opacity: isLocked ? 0.6 : 1,
            }}
        >
            {/* Type tag + lock */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Tag variant={TYPE_TAG[test.type] || "muted"}>
                        {TYPE_LABEL[test.type] || test.type}
                    </Tag>
                    {test.type === "dpp" && test.subject && (
                        <Tag variant={SUBJECT_TAG[test.subject] || "muted"}>
                            {SUBJECT_LABEL[test.subject] || test.subject}
                        </Tag>
                    )}
                </div>
                {isLocked && (
                    <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        <LockIcon /> Locked
                    </span>
                )}
                {isCompleted && score !== null && (
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 700, color: `var(--${scoreColor})` }}>
                        {score}/{test.total_marks}
                    </span>
                )}
            </div>

            {/* Title */}
            <h3
                style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    lineHeight: 1.3,
                }}
            >
                {test.title}
            </h3>

            {/* Details row */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <ClockIcon /> {test.duration_minutes} min
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    +{test.marks_correct}/-{Math.abs(test.marks_wrong)}
                </span>
                {test.scheduled_at && (
                    <span style={{ fontSize: 12, color: "var(--gold)" }}>
                        Due: {new Date(test.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                )}
            </div>

            {/* Score bar if completed */}
            {isCompleted && score !== null && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Score</span>
                        <span style={{ fontSize: 12, color: `var(--${scoreColor})`, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <ProgressBar value={pct} color={scoreColor as "green" | "gold" | "red"} height={6} />
                </div>
            )}

            {/* Action */}
            <div>
                {isLocked ? (
                    <button
                        className="btn btn-ghost"
                        disabled
                        style={{ width: "100%", fontSize: 13 }}
                    >
                        <LockIcon /> Locked
                    </button>
                ) : isCompleted ? (
                    <Link
                        href={`/tests/${test.id}/result`}
                        className="btn btn-secondary"
                        style={{ width: "100%", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                        View Result
                    </Link>
                ) : isInProgress ? (
                    <Link
                        href={`/tests/${test.id}`}
                        className="btn btn-primary"
                        style={{ width: "100%", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                        Continue Test
                    </Link>
                ) : (
                    <Link
                        href={`/tests/${test.id}`}
                        className="btn btn-primary"
                        style={{ width: "100%", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        Start Test
                    </Link>
                )}
            </div>
        </div>
    );
}
