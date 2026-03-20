"use client";

import { useState, useMemo } from "react";
import { Test, TestAttempt } from "@/lib/types";
import TestCard from "@/components/tests/TestCard";

interface TestsClientProps {
    tests: Test[];
    attempts: TestAttempt[];
}

const FILTERS = [
    { value: "all", label: "All" },
    { value: "chapter_test", label: "Chapter Tests" },
    { value: "full_mock", label: "Full Mocks" },
    { value: "dpp", label: "DPP" },
    { value: "upcoming", label: "Upcoming" },
];

const SUBJECT_FILTERS = [
    { value: "all", label: "All Subjects" },
    { value: "biology", label: "Biology" },
    { value: "chemistry", label: "Chemistry" },
    { value: "physics", label: "Physics" },
] as const;

export default function TestsClient({ tests, attempts }: TestsClientProps) {
    const [activeFilter, setActiveFilter] = useState("all");
    const [activeSubject, setActiveSubject] = useState<(typeof SUBJECT_FILTERS)[number]["value"]>("all");

    const attemptMap = useMemo(() => {
        const map: Record<string, TestAttempt> = {};
        for (const a of attempts) {
            // If multiple attempts, keep most recent
            if (!map[a.test_id] || new Date(a.started_at) > new Date(map[a.test_id].started_at)) {
                map[a.test_id] = a;
            }
        }
        return map;
    }, [attempts]);

    const filtered = useMemo(() => {
        let base = tests;

        // Type filter
        if (activeFilter === "upcoming") {
            base = base.filter((t) => t.scheduled_at && !attemptMap[t.id]?.is_completed);
        } else if (activeFilter !== "all") {
            base = base.filter((t) => t.type === activeFilter);
        }

        // Subject filter
        if (activeSubject !== "all") {
            base = base.filter((t) => t.subject === activeSubject);
        }

        return base;
    }, [tests, activeFilter, attemptMap, activeSubject]);

    return (
        <div>
            {/* Filter tabs */}
            <div
                style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 24,
                    background: "var(--surface)",
                    padding: 4,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    width: "fit-content",
                }}
            >
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        id={`test-filter-${f.value}`}
                        onClick={() => setActiveFilter(f.value)}
                        style={{
                            padding: "6px 16px",
                            borderRadius: 6,
                            border: "none",
                            cursor: "pointer",
                            fontSize: 13,
                            fontFamily: "'Outfit', sans-serif",
                            fontWeight: 500,
                            background: activeFilter === f.value ? "var(--surface-3)" : "transparent",
                            color: activeFilter === f.value ? "var(--text-primary)" : "var(--text-muted)",
                            transition: "all 0.15s",
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Subject filter */}
            <div
                style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 16,
                    background: "var(--surface)",
                    padding: 4,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    width: "fit-content",
                }}
            >
                {SUBJECT_FILTERS.map((s) => (
                    <button
                        key={s.value}
                        id={`subject-filter-${s.value}`}
                        onClick={() => setActiveSubject(s.value)}
                        style={{
                            padding: "6px 16px",
                            borderRadius: 6,
                            border: "none",
                            cursor: "pointer",
                            fontSize: 13,
                            fontFamily: "'Outfit', sans-serif",
                            fontWeight: 500,
                            background: activeSubject === s.value ? "var(--surface-3)" : "transparent",
                            color: activeSubject === s.value ? "var(--text-primary)" : "var(--text-muted)",
                            transition: "all 0.15s",
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Test count */}
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                {filtered.length} {filtered.length === 1 ? "test" : "tests"}
            </p>

            {filtered.length === 0 ? (
                <div
                    style={{
                        padding: "60px 40px",
                        textAlign: "center",
                        background: "var(--surface)",
                        border: "1px dashed var(--border)",
                        borderRadius: "var(--card-radius)",
                    }}
                >
                    <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No tests found</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>
                        Tests will appear here when your mentor activates them.
                    </p>
                </div>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 16,
                    }}
                >
                    {filtered.map((test) => (
                        <TestCard
                            key={test.id}
                            test={test}
                            attempt={attemptMap[test.id] ?? null}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
