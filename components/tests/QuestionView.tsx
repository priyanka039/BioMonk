import { Question, TestResponse } from "@/lib/types";

interface QuestionViewProps {
    question: Question;
    questionNumber: number;
    totalQuestions: number;
    response: TestResponse | null;
    onSelect: (option: "A" | "B" | "C" | "D") => void;
    reviewMode?: boolean;
}

const OPTIONS: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
const OPTION_TEXT: Record<"A" | "B" | "C" | "D", keyof Question> = {
    A: "option_a",
    B: "option_b",
    C: "option_c",
    D: "option_d",
};

export default function QuestionView({
    question,
    questionNumber,
    totalQuestions,
    response,
    onSelect,
    reviewMode = false,
}: QuestionViewProps) {
    const selected = response?.selected_option as "A" | "B" | "C" | "D" | null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Question header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                        style={{
                            fontFamily: "'Fraunces', serif",
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--text-muted)",
                        }}
                    >
                        Q{questionNumber}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ {totalQuestions}</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--green)",
                            background: "rgba(43,191,120,0.1)",
                            padding: "2px 10px",
                            borderRadius: 99,
                            fontWeight: 600,
                        }}
                    >
                        +4
                    </span>
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--red)",
                            background: "rgba(224,82,82,0.1)",
                            padding: "2px 10px",
                            borderRadius: 99,
                            fontWeight: 600,
                        }}
                    >
                        -1
                    </span>
                </div>
            </div>

            {/* Question text */}
            <div
                style={{
                    fontSize: 15.5,
                    lineHeight: 1.7,
                    color: "var(--text-primary)",
                    padding: "16px 18px",
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                }}
                dangerouslySetInnerHTML={{ __html: question.question_text.replace(/\n/g, "<br/>") }}
            />

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {OPTIONS.map((opt) => {
                    const text = question[OPTION_TEXT[opt]] as string;
                    const isSelected = selected === opt;
                    const isCorrect = reviewMode && question.correct_option === opt;
                    const isWrong = reviewMode && isSelected && !isCorrect;

                    let cls = "option-row";
                    if (isCorrect) cls += " correct";
                    else if (isWrong) cls += " wrong";
                    else if (isSelected) cls += " selected";

                    return (
                        <div
                            key={opt}
                            className={cls}
                            onClick={() => !reviewMode && onSelect(opt)}
                            role={reviewMode ? "listitem" : "button"}
                            tabIndex={reviewMode ? undefined : 0}
                            onKeyDown={(e) => {
                                if (!reviewMode && (e.key === "Enter" || e.key === " ")) onSelect(opt);
                            }}
                        >
                            <div className="option-key">{opt}</div>
                            <p style={{ fontSize: 14.5, color: "var(--text-primary)", lineHeight: 1.5, flex: 1 }}>
                                {text}
                            </p>
                            {isCorrect && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                            {isWrong && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Explanation in review mode */}
            {reviewMode && question.explanation && (
                <div
                    style={{
                        padding: "14px 16px",
                        background: "rgba(43,191,120,0.07)",
                        border: "1px solid rgba(43,191,120,0.2)",
                        borderRadius: 8,
                    }}
                >
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Explanation
                    </p>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {question.explanation}
                    </p>
                </div>
            )}
        </div>
    );
}
