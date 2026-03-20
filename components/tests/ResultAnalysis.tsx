"use client";

import { useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { Test, Question, TestAttempt, TestResponse } from "@/lib/types";
import QuestionView from "./QuestionView";
import ProgressBar from "@/components/ui/ProgressBar";
import Link from "next/link";

interface ResultAnalysisProps {
    test: Test;
    attempt: TestAttempt;
    questions: Question[];
    responses: TestResponse[];
    batchRank: number;
    afterScoreHero?: React.ReactNode;
}

export default function ResultAnalysis({
    test,
    attempt,
    questions,
    responses,
    batchRank,
    afterScoreHero,
}: ResultAnalysisProps) {
    const [reviewIndex, setReviewIndex] = useState<number | null>(null);
    const router = useRouter();

    const responseMap: Record<string, TestResponse> = {};
    for (const r of responses) {
        responseMap[r.question_id] = r;
    }

    const score = attempt.score ?? 0;
    const totalMarks = test.total_marks;
    const pct = Math.round((score / totalMarks) * 100);

    let correct = 0, wrong = 0, unattempted = 0;
    for (const q of questions) {
        const r = responseMap[q.id];
        if (!r?.selected_option) unattempted++;
        else if (r.selected_option === q.correct_option) correct++;
        else wrong++;
    }

    const scoreColor = pct >= 80 ? "var(--green)" : pct >= 60 ? "var(--gold)" : "var(--red)";

    // Chapter-wise breakdown
    interface ChapterGroup {
        name: string;
        total: number;
        correct: number;
    }
    const chapterGroups: Record<string, ChapterGroup> = {};
    for (const q of questions) {
        const chapter = (q as any).chapter?.name || (test as any).chapter?.name || "General";
        if (!chapterGroups[chapter]) {
            chapterGroups[chapter] = { name: chapter, total: 0, correct: 0 };
        }
        chapterGroups[chapter].total++;
        const r = responseMap[q.id];
        if (r?.selected_option === q.correct_option) {
            chapterGroups[chapter].correct++;
        }
    }

    if (reviewIndex !== null) {
        const q = questions[reviewIndex];
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "var(--bg)",
                    padding: "32px 40px",
                    maxWidth: 900,
                    margin: "0 auto",
                }}
            >
                {/* Back button */}
                <button
                    onClick={() => setReviewIndex(null)}
                    className="btn btn-ghost"
                    style={{ marginBottom: 24 }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                    Back to Results
                </button>

                <div className="card" style={{ padding: 28, marginBottom: 16 }}>
                    <QuestionView
                        question={q}
                        questionNumber={reviewIndex + 1}
                        totalQuestions={questions.length}
                        response={responseMap[q.id] ?? null}
                        onSelect={() => { }}
                        reviewMode={true}
                    />
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button
                        onClick={() => setReviewIndex(Math.max(0, reviewIndex - 1))}
                        disabled={reviewIndex === 0}
                        className="btn btn-ghost"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                        Previous
                    </button>
                    <span style={{ display: "flex", alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
                        {reviewIndex + 1} / {questions.length}
                    </span>
                    <button
                        onClick={() => setReviewIndex(Math.min(questions.length - 1, reviewIndex + 1))}
                        disabled={reviewIndex === questions.length - 1}
                        className="btn btn-ghost"
                    >
                        Next
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                padding: "32px 40px",
                maxWidth: 1000,
                margin: "0 auto",
            }}
        >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>
                        Test Result
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
                        {test.title}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link
                        href={`/tests/${test.id}/result/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ textDecoration: "none" }}
                    >
                        Download PDF
                    </Link>
                    <Link href="/tests" className="btn btn-ghost" style={{ textDecoration: "none" }}>
                        All Tests
                    </Link>
                </div>
            </div>

            {/* Score card */}
            <div
                className="card"
                style={{
                    padding: "32px 40px",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 40,
                    background: "var(--surface)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        right: -30,
                        top: -30,
                        width: 160,
                        height: 160,
                        borderRadius: "50%",
                        background: `${scoreColor}08`,
                    }}
                />
                <div style={{ textAlign: "center", minWidth: 140 }}>
                    <p
                        className="stat-number"
                        style={{ fontSize: 56, color: scoreColor, lineHeight: 1 }}
                    >
                        {score}
                    </p>
                    <p style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 4 }}>
                        / {totalMarks}
                    </p>
                    <p style={{ fontSize: 20, fontFamily: "'Fraunces',serif", fontWeight: 700, color: scoreColor, marginTop: 6 }}>
                        {pct}%
                    </p>
                </div>

                <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />

                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
                    {[
                        { label: "Rank in Batch", value: `#${batchRank}`, color: "var(--gold)" },
                        { label: "Correct", value: `${correct}`, color: "var(--green)" },
                        { label: "Wrong", value: `${wrong}`, color: "var(--red)" },
                        { label: "Unattempted", value: `${unattempted}`, color: "var(--text-muted)" },
                    ].map((s) => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                            <p className="stat-number" style={{ fontSize: 24, color: s.color }}>
                                {s.value}
                            </p>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                {s.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {afterScoreHero ? <div style={{ marginBottom: 20 }}>{afterScoreHero}</div> : null}

            {/* Breakdown table */}
            <div
                className="card"
                style={{ padding: "20px 24px", marginBottom: 20 }}
            >
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, marginBottom: 16 }}>
                    Score Breakdown
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            {["Category", "Count", "Marks", "Contribution"].map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        padding: "8px 12px",
                                        textAlign: "left",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--text-muted)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        borderBottom: "1px solid var(--border)",
                                    }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            {
                                cat: "Correct",
                                count: correct,
                                marks: test.marks_correct,
                                contribution: correct * test.marks_correct,
                                color: "var(--green)",
                            },
                            {
                                cat: "Wrong",
                                count: wrong,
                                marks: test.marks_wrong,
                                contribution: wrong * test.marks_wrong,
                                color: "var(--red)",
                            },
                            {
                                cat: "Unattempted",
                                count: unattempted,
                                marks: 0,
                                contribution: 0,
                                color: "var(--text-muted)",
                            },
                        ].map((row) => (
                            <tr key={row.cat}>
                                <td style={{ padding: "10px 12px", color: row.color, fontWeight: 500, fontSize: 13 }}>
                                    {row.cat}
                                </td>
                                <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontSize: 13 }}>
                                    {row.count}
                                </td>
                                <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 13 }}>
                                    {row.marks > 0 ? `+${row.marks}` : row.marks === 0 ? "0" : row.marks} per q
                                </td>
                                <td style={{ padding: "10px 12px", color: row.contribution >= 0 ? "var(--green)" : "var(--red)", fontSize: 13, fontWeight: 600 }}>
                                    {row.contribution > 0 ? "+" : ""}{row.contribution}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Chapter-wise accuracy */}
            {Object.keys(chapterGroups).length > 0 && (
                <div className="card" style={{ padding: "20px 24px", marginBottom: 20 }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, marginBottom: 16 }}>
                        Chapter-wise Accuracy
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {Object.values(chapterGroups).map((g) => {
                            const acc = g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0;
                            const color = acc >= 80 ? "green" : acc >= 60 ? "gold" : "red";
                            return (
                                <div key={g.name}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                        <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{g.name}</span>
                                        <span style={{ fontSize: 12, color: `var(--${color})`, fontWeight: 600 }}>
                                            {g.correct}/{g.total} ({acc}%)
                                        </span>
                                    </div>
                                    <ProgressBar value={acc} color={color as "green" | "gold" | "red"} height={6} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Question-by-question review */}
            <div className="card" style={{ padding: "20px 24px" }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, marginBottom: 16 }}>
                    Question Review
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {questions.map((q, idx) => {
                        const r = responseMap[q.id];
                        const isCorrect = r?.selected_option === q.correct_option;
                        const isWrong = r?.selected_option && !isCorrect;
                        const status = !r?.selected_option ? "unattempted" : isCorrect ? "correct" : "wrong";
                        const statusColor = status === "correct" ? "var(--green)" : status === "wrong" ? "var(--red)" : "var(--text-muted)";

                        return (
                            <div
                                key={q.id}
                                onClick={() => setReviewIndex(idx)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                    padding: "12px 14px",
                                    background: "var(--surface-2)",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    border: "1px solid var(--border)",
                                    transition: "border-color 0.15s",
                                }}
                            >
                                <span
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        background: `${statusColor}18`,
                                        color: statusColor,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                >
                                    {idx + 1}
                                </span>
                                <p style={{ flex: 1, color: "var(--text-secondary)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {q.question_text}
                                </p>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: statusColor,
                                        flexShrink: 0,
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {status}
                                </span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
