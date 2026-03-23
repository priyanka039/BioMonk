"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Test, Question, TestAttempt, TestResponse } from "@/lib/types";
import ExamTimer from "@/components/tests/ExamTimer";
import QuestionView from "@/components/tests/QuestionView";
import QuestionNavigator from "@/components/tests/QuestionNavigator";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface TestTakingClientProps {
    test: Test;
    questions: Question[];
    userId: string;
    existingAttempt: TestAttempt | null;
    existingResponses: TestResponse[];
    remainingSeconds: number;
}

type ResponseState = Record<string, { selected_option: string | null; is_marked_for_review: boolean }>;

export default function TestTakingClient({
    test,
    questions,
    userId,
    existingAttempt,
    existingResponses,
    remainingSeconds,
}: TestTakingClientProps) {
    const router = useRouter();
    const supabase = createClient();

    // Convert existing responses to state
    const initialResponses: ResponseState = {};
    for (const q of questions) {
        const existing = existingResponses.find((r) => r.question_id === q.id);
        initialResponses[q.id] = {
            selected_option: existing?.selected_option ?? null,
            is_marked_for_review: existing?.is_marked_for_review ?? false,
        };
    }

    const [phase, setPhase] = useState<"confirm" | "taking" | "submitting">(
        existingAttempt ? "taking" : "confirm"
    );
    const [attemptId, setAttemptId] = useState<string | null>(existingAttempt?.id ?? null);
    const [responses, setResponses] = useState<ResponseState>(initialResponses);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [starting, setStarting] = useState(false);

    const currentQuestion = questions[currentIndex];

    // Begin the test
    async function handleBegin() {
        setStarting(true);
        const { data, error } = await supabase
            .from("test_attempts")
            .insert({
                student_id: userId,
                test_id: test.id,
                started_at: new Date().toISOString(),
                is_completed: false,
            })
            .select()
            .single();

        if (error || !data) {
            setStarting(false);
            return;
        }

        // Create blank responses for all questions
        const blankResponses = questions.map((q) => ({
            attempt_id: data.id,
            question_id: q.id,
            selected_option: null,
            is_marked_for_review: false,
            time_spent_seconds: 0,
        }));

        await supabase.from("test_responses").insert(blankResponses);

        setAttemptId(data.id);
        setPhase("taking");
        setStarting(false);
    }

    // Select an option and immediately save to Supabase
    const handleSelect = useCallback(
        async (option: "A" | "B" | "C" | "D") => {
            if (!attemptId) return;
            const qid = currentQuestion.id;

            setResponses((prev) => ({
                ...prev,
                [qid]: { ...prev[qid], selected_option: option },
            }));

            await supabase
                .from("test_responses")
                .update({ selected_option: option })
                .eq("attempt_id", attemptId)
                .eq("question_id", qid);
        },
        [attemptId, currentQuestion, supabase]
    );

    // Toggle mark for review
    const handleMarkReview = useCallback(async () => {
        if (!attemptId) return;
        const qid = currentQuestion.id;
        const newVal = !responses[qid]?.is_marked_for_review;

        setResponses((prev) => ({
            ...prev,
            [qid]: { ...prev[qid], is_marked_for_review: newVal },
        }));

        await supabase
            .from("test_responses")
            .update({ is_marked_for_review: newVal })
            .eq("attempt_id", attemptId)
            .eq("question_id", qid);
    }, [attemptId, currentQuestion, responses, supabase]);

    // Submit the test
    async function handleSubmit() {
        if (!attemptId || submitting) return;
        setSubmitting(true);

        // Calculate score
        let score = 0;
        for (const q of questions) {
            const resp = responses[q.id];
            if (resp?.selected_option === q.correct_option) {
                score += test.marks_correct;
            } else if (resp?.selected_option) {
                score += test.marks_wrong; // negative
            }
        }

        const maxScore = questions.length * (test.marks_correct ?? 4);

        // Persist max_score if the column exists (keeps historical max accurate).
        const { error: updErr } = await supabase
            .from("test_attempts")
            .update({
                submitted_at: new Date().toISOString(),
                score,
                max_score: maxScore,
                is_completed: true,
            })
            .eq("id", attemptId);

        if (updErr && /max_score/i.test(updErr.message || "")) {
            // Column doesn't exist yet — retry without max_score.
            const { error: updErr2 } = await supabase
                .from("test_attempts")
                .update({
                    submitted_at: new Date().toISOString(),
                    score,
                    is_completed: true,
                })
                .eq("id", attemptId);
            if (updErr2) {
                setSubmitting(false);
                return;
            }
        }

        router.push(`/tests/${test.id}/result`);
    }

    if (phase === "confirm") {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "var(--bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                }}
            >
                <div
                    className="card"
                    style={{ maxWidth: 500, width: "100%", padding: 40 }}
                >
                    {/* Logo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
                        <div style={{ width: 32, height: 32, background: "var(--green)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10" /><path d="M12 8v4l3 3" /><path d="M20 2c-2 4-6 6-8 8" /></svg>
                        </div>
                        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16 }}>BioMonk</span>
                    </div>

                    <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 8 }}>
                        {test.title}
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>
                        Read the details carefully before starting
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                        {[
                            ["Questions", `${questions.length}`],
                            ["Duration", `${test.duration_minutes} minutes`],
                            ["Total Marks", `${questions.length * (test.marks_correct ?? 4)}`],
                            ["Marking Scheme", `+${test.marks_correct} correct, ${test.marks_wrong} wrong`],
                            ["Type", test.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())],
                        ].map(([label, value]) => (
                            <div
                                key={label}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "10px 14px",
                                    background: "var(--surface-2)",
                                    borderRadius: 7,
                                }}
                            >
                                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</span>
                                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{value}</span>
                            </div>
                        ))}
                    </div>

                    <div
                        style={{
                            padding: "12px 14px",
                            background: "rgba(224,82,82,0.07)",
                            border: "1px solid rgba(224,82,82,0.18)",
                            borderRadius: 8,
                            marginBottom: 24,
                        }}
                    >
                        <p style={{ color: "var(--red)", fontSize: 12.5, lineHeight: 1.6 }}>
                            Once you begin, the timer starts. Do not close the tab — your progress is saved automatically. You cannot return to the test after submission.
                        </p>
                    </div>

                    <button
                        onClick={handleBegin}
                        disabled={starting}
                        id="begin-test-btn"
                        style={{
                            width: "100%",
                            background: "var(--green)",
                            border: "none",
                            borderRadius: "var(--btn-radius)",
                            color: "#fff",
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            padding: "14px",
                            cursor: starting ? "not-allowed" : "pointer",
                            opacity: starting ? 0.7 : 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        {starting ? (
                            <>
                                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                                Starting...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                Begin Test
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                style={{
                    minHeight: "100vh",
                    background: "var(--bg)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Test header bar */}
                <div
                    style={{
                        height: 52,
                        background: "var(--surface)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 24px",
                    }}
                >
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                        {test.title}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Question {currentIndex + 1} of {questions.length}
                    </span>
                </div>

                <div style={{ display: "flex", flex: 1 }}>
                    {/* Main question area */}
                    <div
                        style={{
                            flex: 1,
                            padding: "28px 32px",
                            maxWidth: "calc(100% - 280px)",
                            overflowY: "auto",
                        }}
                    >
                        <QuestionView
                            question={currentQuestion}
                            questionNumber={currentIndex + 1}
                            totalQuestions={questions.length}
                            response={
                                responses[currentQuestion.id]
                                    ? ({
                                        id: "",
                                        attempt_id: attemptId || "",
                                        question_id: currentQuestion.id,
                                        selected_option: responses[currentQuestion.id].selected_option as any,
                                        is_marked_for_review: responses[currentQuestion.id].is_marked_for_review,
                                        time_spent_seconds: 0,
                                    } as TestResponse)
                                    : null
                            }
                            onSelect={handleSelect}
                        />

                        {/* Action bar */}
                        <div
                            style={{
                                display: "flex",
                                gap: 10,
                                marginTop: 28,
                                paddingTop: 20,
                                borderTop: "1px solid var(--border)",
                            }}
                        >
                            <button
                                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                                disabled={currentIndex === 0}
                                className="btn btn-ghost"
                                aria-label="Previous question"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                                Previous
                            </button>
                            <button
                                onClick={handleMarkReview}
                                className="btn"
                                style={{
                                    background: responses[currentQuestion.id]?.is_marked_for_review
                                        ? "rgba(224,156,44,0.15)"
                                        : "var(--surface-3)",
                                    color: responses[currentQuestion.id]?.is_marked_for_review
                                        ? "var(--gold)"
                                        : "var(--text-secondary)",
                                    border: responses[currentQuestion.id]?.is_marked_for_review
                                        ? "1px solid rgba(224,156,44,0.3)"
                                        : "1px solid var(--border)",
                                }}
                                aria-label="Mark for review"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                                {responses[currentQuestion.id]?.is_marked_for_review ? "Marked" : "Mark for Review"}
                            </button>
                            <button
                                onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                                className="btn btn-primary"
                                style={{ marginLeft: "auto" }}
                                aria-label="Save and next"
                            >
                                Save &amp; Next
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Right sidebar */}
                    <div
                        style={{
                            width: 280,
                            flexShrink: 0,
                            background: "var(--surface)",
                            borderLeft: "1px solid var(--border)",
                            padding: "24px 20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 24,
                            overflowY: "auto",
                        }}
                    >
                        {/* Timer */}
                        <ExamTimer
                            totalSeconds={remainingSeconds}
                            onExpire={() => {
                                setShowSubmitModal(true);
                            }}
                        />

                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                            <QuestionNavigator
                                questions={questions}
                                responses={responses}
                                currentIndex={currentIndex}
                                onJump={setCurrentIndex}
                            />
                        </div>

                        <button
                            onClick={() => setShowSubmitModal(true)}
                            id="submit-test-btn"
                            className="btn btn-primary"
                            style={{ width: "100%", background: "var(--red)" }}
                        >
                            Submit Test
                        </button>
                    </div>
                </div>
            </div>

            {/* Submit confirmation modal */}
            <Modal
                isOpen={showSubmitModal}
                onClose={() => !submitting && setShowSubmitModal(false)}
                title="Submit Test"
                maxWidth={440}
            >
                <div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                        Are you sure you want to submit? This action cannot be undone.
                    </p>

                    {/* Summary */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                        {(() => {
                            const answered = questions.filter((q) => responses[q.id]?.selected_option).length;
                            const unanswered = questions.length - answered;
                            return (
                                <>
                                    <div style={{ flex: 1, padding: "10px", background: "var(--surface-2)", borderRadius: 8, textAlign: "center" }}>
                                        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "var(--green)" }}>{answered}</p>
                                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Answered</p>
                                    </div>
                                    <div style={{ flex: 1, padding: "10px", background: "var(--surface-2)", borderRadius: 8, textAlign: "center" }}>
                                        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "var(--red)" }}>{unanswered}</p>
                                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Unanswered</p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <Button
                            variant="ghost"
                            onClick={() => setShowSubmitModal(false)}
                            disabled={submitting}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleSubmit}
                            loading={submitting}
                            style={{ flex: 1 }}
                            id="confirm-submit-btn"
                        >
                            Confirm Submit
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
