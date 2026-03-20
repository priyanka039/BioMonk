interface QuestionNavigatorProps {
    questions: { id: string }[];
    responses: Record<string, { selected_option: string | null; is_marked_for_review: boolean }>;
    currentIndex: number;
    onJump: (index: number) => void;
}

export default function QuestionNavigator({
    questions,
    responses,
    currentIndex,
    onJump,
}: QuestionNavigatorProps) {
    const answered = questions.filter((q) => responses[q.id]?.selected_option).length;
    const marked = questions.filter((q) => responses[q.id]?.is_marked_for_review).length;
    const unanswered = questions.length - answered;

    return (
        <div>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                    { label: "Answered", value: answered, color: "var(--green)" },
                    { label: "Unanswered", value: unanswered, color: "var(--text-muted)" },
                    { label: "Marked", value: marked, color: "var(--gold)" },
                    { label: "Total", value: questions.length, color: "var(--text-primary)" },
                ].map((s) => (
                    <div
                        key={s.label}
                        style={{
                            padding: "8px 10px",
                            background: "var(--surface-2)",
                            borderRadius: 6,
                            textAlign: "center",
                        }}
                    >
                        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: s.color }}>
                            {s.value}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {s.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* Grid */}
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Questions
            </p>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 5,
                }}
            >
                {questions.map((q, idx) => {
                    const resp = responses[q.id];
                    const isAnswered = !!resp?.selected_option;
                    const isMarked = !!resp?.is_marked_for_review;
                    const isCurrent = idx === currentIndex;

                    let cls = "q-nav-btn ";
                    if (isCurrent) cls += "q-nav-current";
                    else if (isMarked) cls += "q-nav-marked";
                    else if (isAnswered) cls += "q-nav-answered";
                    else cls += "q-nav-unanswered";

                    return (
                        <button
                            key={q.id}
                            id={`q-nav-${idx + 1}`}
                            className={cls}
                            onClick={() => onJump(idx)}
                            aria-label={`Go to question ${idx + 1}`}
                            aria-current={isCurrent ? "true" : undefined}
                        >
                            {idx + 1}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {[
                    { color: "var(--green)", label: "Answered" },
                    { color: "var(--gold)", label: "Marked" },
                    { color: "var(--blue)", label: "Current" },
                    { color: "var(--surface-3)", label: "Not visited" },
                ].map((l) => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                        {l.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
