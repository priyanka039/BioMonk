"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import QuestionView from "@/components/tests/QuestionView";
import type { TestResponse } from "@/lib/types";
import { isDerivedErrorBookEntry } from "@/lib/error-book";
import {
    getLocalErrorBookState,
    getLocalNotes,
    setLocalNotes,
    setLocalRemoved,
    setLocalResolved,
} from "@/lib/error-book-local";
import type { ErrorBookActionResult, ErrorBookEntryWithRelations, ErrorBookFilter } from "@/lib/error-book-types";
import {
    markErrorBookEntryResolved,
    markErrorBookEntryUnresolved,
    updateErrorBookEntryNotes,
    removeErrorBookEntry,
} from "./actions";

interface ErrorBookClientProps {
    entries: ErrorBookEntryWithRelations[];
    persistEnabled: boolean;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function applyLocalState(entries: ErrorBookEntryWithRelations[]) {
    const local = getLocalErrorBookState();

    return entries
        .filter((entry) => !local.removedQuestionIds.includes(entry.question_id))
        .map((entry) => {
            const locallyResolved = local.resolvedQuestionIds.includes(entry.question_id);
            const localNotes = local.notesByQuestionId[entry.question_id] ?? null;

            return {
                ...entry,
                resolved_at: entry.resolved_at ?? (locallyResolved ? entry.created_at : null),
                notes: entry.notes ?? localNotes,
            };
        });
}

export default function ErrorBookClient({ entries, persistEnabled }: ErrorBookClientProps) {
    const [filter, setFilter] = useState<ErrorBookFilter>("unresolved");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [localVersion, setLocalVersion] = useState(0);
    const [isPending, startTransition] = useTransition();

    const displayEntries = useMemo(() => {
        void localVersion;
        const merged = persistEnabled
            ? entries
            : applyLocalState(entries);
        return merged;
    }, [entries, persistEnabled, localVersion]);

    const filtered = useMemo(() => {
        if (filter === "all") return displayEntries;
        if (filter === "resolved") return displayEntries.filter((e) => e.resolved_at);
        return displayEntries.filter((e) => !e.resolved_at);
    }, [displayEntries, filter]);

    const stats = useMemo(() => {
        const unresolved = displayEntries.filter((e) => !e.resolved_at).length;
        const resolved = displayEntries.filter((e) => e.resolved_at).length;
        return { total: displayEntries.length, unresolved, resolved };
    }, [displayEntries]);

    function bumpLocal() {
        setLocalVersion((v) => v + 1);
    }

    function runServerAction(action: () => Promise<ErrorBookActionResult>) {
        setActionMessage(null);
        startTransition(async () => {
            const result = await action();
            if (!result.ok) {
                setActionMessage(result.error);
            }
        });
    }

    function usesServerPersist(entry: ErrorBookEntryWithRelations) {
        return persistEnabled && !isDerivedErrorBookEntry(entry);
    }

    function handleResolve(entry: ErrorBookEntryWithRelations, resolved: boolean) {
        if (usesServerPersist(entry)) {
            runServerAction(() =>
                resolved
                    ? markErrorBookEntryResolved(entry.id)
                    : markErrorBookEntryUnresolved(entry.id)
            );
            return;
        }
        setLocalResolved(entry.question_id, resolved);
        bumpLocal();
    }

    function handleSaveNotes(entry: ErrorBookEntryWithRelations) {
        const notes = notesDraft[entry.id] ?? entry.notes ?? getLocalNotes(entry.question_id) ?? "";
        if (usesServerPersist(entry)) {
            runServerAction(() => updateErrorBookEntryNotes(entry.id, notes));
            return;
        }
        setLocalNotes(entry.question_id, notes);
        bumpLocal();
    }

    function handleRemove(entry: ErrorBookEntryWithRelations) {
        if (!confirm("Remove this mistake from your error book?")) return;
        if (usesServerPersist(entry)) {
            runServerAction(() => removeErrorBookEntry(entry.id));
            return;
        }
        setLocalRemoved(entry.question_id);
        if (expandedId === entry.id) setExpandedId(null);
        bumpLocal();
    }

    function toResponse(entry: ErrorBookEntryWithRelations): TestResponse {
        return {
            id: entry.id,
            attempt_id: entry.attempt_id,
            question_id: entry.question_id,
            selected_option: entry.selected_option,
            is_marked_for_review: false,
            time_spent_seconds: 0,
        };
    }

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 640 }}>
                    Questions you answered incorrectly are saved here automatically after each test.
                    Review them, add notes, and mark as resolved once you have mastered the concept.
                </p>
                {!persistEnabled && (
                    <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                        Notes and resolved status are saved on this browser. For cloud sync across devices, run{" "}
                        <code>supabase/migrations/004_error_book.sql</code> in Supabase SQL Editor.
                    </p>
                )}
                {actionMessage && (
                    <div
                        style={{
                            marginTop: 12,
                            padding: "12px 14px",
                            borderRadius: 8,
                            background: "rgba(224,82,82,0.08)",
                            border: "1px solid rgba(224,82,82,0.2)",
                            fontSize: 13,
                            color: "var(--red)",
                        }}
                    >
                        {actionMessage}
                    </div>
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                {[
                    { label: "Total Mistakes", value: stats.total, color: "var(--red)" },
                    { label: "To Review", value: stats.unresolved, color: "var(--gold)" },
                    { label: "Resolved", value: stats.resolved, color: "var(--green)" },
                ].map((s) => (
                    <div key={s.label} className="card" style={{ padding: "20px 24px" }}>
                        <p className="stat-number" style={{ fontSize: 36, color: s.color }}>
                            {s.value}
                        </p>
                        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>{s.label}</p>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {([
                    ["unresolved", "To Review"],
                    ["all", "All"],
                    ["resolved", "Resolved"],
                ] as const).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        className={filter === value ? "btn btn-primary" : "btn btn-secondary"}
                        style={{ fontSize: 13 }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div
                    className="card"
                    style={{
                        padding: "48px 32px",
                        textAlign: "center",
                        background: "var(--surface-2)",
                    }}
                >
                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 8 }}>
                        {filter === "resolved" ? "No resolved mistakes yet" : "Your error book is empty"}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
                        {filter === "resolved"
                            ? "Mark questions as resolved after you review and understand them."
                            : "Complete a test and any wrong answers will appear here automatically."}
                    </p>
                    {filter !== "resolved" && (
                        <Link href="/tests" className="btn btn-primary" style={{ textDecoration: "none" }}>
                            Go to Tests
                        </Link>
                    )}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filtered.map((entry, index) => {
                        const isExpanded = expandedId === entry.id;
                        const isResolved = Boolean(entry.resolved_at);

                        return (
                            <div key={entry.id} className="card" style={{ padding: "16px 20px" }}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 14,
                                        cursor: "pointer",
                                    }}
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                >
                                    <span
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: isResolved ? "rgba(43,191,120,0.12)" : "rgba(224,82,82,0.12)",
                                            color: isResolved ? "var(--green)" : "var(--red)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {index + 1}
                                    </span>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p
                                            style={{
                                                fontSize: 14,
                                                color: "var(--text-primary)",
                                                fontWeight: 500,
                                                marginBottom: 6,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {entry.question?.question_text ?? "Question unavailable"}
                                        </p>
                                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                {entry.test?.title ?? "Test"}
                                            </span>
                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                {formatDate(entry.created_at)}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: isResolved ? "var(--green)" : "var(--gold)",
                                                    background: isResolved
                                                        ? "rgba(43,191,120,0.1)"
                                                        : "rgba(245,166,35,0.1)",
                                                    padding: "2px 8px",
                                                    borderRadius: 99,
                                                }}
                                            >
                                                {isResolved ? "Resolved" : "Needs review"}
                                            </span>
                                            <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 600 }}>
                                                Your answer: {entry.selected_option}
                                            </span>
                                            <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                                                Correct: {entry.correct_option}
                                            </span>
                                        </div>
                                    </div>

                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="var(--text-muted)"
                                        strokeWidth="2"
                                        style={{
                                            flexShrink: 0,
                                            transform: isExpanded ? "rotate(90deg)" : "none",
                                            transition: "transform 0.15s",
                                        }}
                                    >
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </div>

                                {isExpanded && entry.question && (
                                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                                        <div className="card" style={{ padding: 24, marginBottom: 16, background: "var(--surface-2)" }}>
                                            <QuestionView
                                                question={entry.question}
                                                questionNumber={index + 1}
                                                totalQuestions={filtered.length}
                                                response={toResponse(entry)}
                                                onSelect={() => {}}
                                                reviewMode
                                            />
                                        </div>

                                        <div style={{ marginBottom: 16 }}>
                                            <label
                                                htmlFor={`notes-${entry.id}`}
                                                style={{
                                                    display: "block",
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: "var(--text-muted)",
                                                    marginBottom: 8,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                }}
                                            >
                                                Your notes
                                            </label>
                                            <textarea
                                                id={`notes-${entry.id}`}
                                                value={notesDraft[entry.id] ?? entry.notes ?? ""}
                                                onChange={(e) =>
                                                    setNotesDraft((prev) => ({
                                                        ...prev,
                                                        [entry.id]: e.target.value,
                                                    }))
                                                }
                                                placeholder="Write what you learned or what to remember..."
                                                rows={3}
                                                style={{
                                                    width: "100%",
                                                    padding: "12px 14px",
                                                    borderRadius: 8,
                                                    border: "1px solid var(--border)",
                                                    background: "var(--surface)",
                                                    color: "var(--text-primary)",
                                                    fontSize: 13,
                                                    resize: "vertical",
                                                    fontFamily: "inherit",
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                style={{ marginTop: 10, fontSize: 13 }}
                                                disabled={isPending}
                                                onClick={() => handleSaveNotes(entry)}
                                            >
                                                Save notes
                                            </button>
                                        </div>

                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                            {isResolved ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    disabled={isPending}
                                                    onClick={() => handleResolve(entry, false)}
                                                >
                                                    Mark as needs review
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    disabled={isPending}
                                                    onClick={() => handleResolve(entry, true)}
                                                >
                                                    Mark as resolved
                                                </button>
                                            )}
                                            <Link
                                                href={`/tests/${entry.test_id}/result`}
                                                className="btn btn-ghost"
                                                style={{ textDecoration: "none", fontSize: 13 }}
                                            >
                                                View test result
                                            </Link>
                                            <button
                                                type="button"
                                                className="btn btn-ghost"
                                                style={{ color: "var(--red)", fontSize: 13 }}
                                                disabled={isPending}
                                                onClick={() => handleRemove(entry)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
