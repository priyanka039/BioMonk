"use client";

import { useState } from "react";
import { Chapter, MaterialType } from "@/lib/types";

interface ChapterFilterProps {
    chapters: Chapter[];
    selectedChapterId: string | null;
    selectedType: MaterialType | "all";
    materialCounts: Record<string, number>;
    onChapterChange: (id: string | null) => void;
    onTypeChange: (type: MaterialType | "all") => void;
}

const TYPES: { value: MaterialType | "all"; label: string }[] = [
    { value: "all", label: "All Types" },
    { value: "notes", label: "Lecture Notes" },
    { value: "mindmap", label: "Mind Maps" },
    { value: "pyq", label: "PYQ Sets" },
    { value: "formula_sheet", label: "Formula Sheets" },
];

export default function ChapterFilter({
    chapters,
    selectedChapterId,
    selectedType,
    materialCounts,
    onChapterChange,
    onTypeChange,
}: ChapterFilterProps) {
    return (
        <div
            style={{
                width: 220,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 24,
            }}
        >
            {/* By Type */}
            <div>
                <p
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        marginBottom: 10,
                    }}
                >
                    By Type
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {TYPES.map((t) => (
                        <button
                            key={t.value}
                            onClick={() => onTypeChange(t.value)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "7px 10px",
                                borderRadius: 6,
                                background:
                                    selectedType === t.value ? "rgba(43,191,120,0.09)" : "transparent",
                                color:
                                    selectedType === t.value ? "var(--green)" : "var(--text-secondary)",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 13,
                                fontFamily: "'Outfit', sans-serif",
                                fontWeight: selectedType === t.value ? 600 : 400,
                                textAlign: "left",
                                width: "100%",
                                transition: "background 0.15s, color 0.15s",
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* By Chapter */}
            <div>
                <p
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        marginBottom: 10,
                    }}
                >
                    By Chapter
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 400, overflowY: "auto" }}>
                    <button
                        onClick={() => onChapterChange(null)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "7px 10px",
                            borderRadius: 6,
                            background: selectedChapterId === null ? "rgba(43,191,120,0.09)" : "transparent",
                            color: selectedChapterId === null ? "var(--green)" : "var(--text-secondary)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 13,
                            fontFamily: "'Outfit', sans-serif",
                            fontWeight: selectedChapterId === null ? 600 : 400,
                            textAlign: "left",
                            width: "100%",
                        }}
                    >
                        All Chapters
                    </button>
                    {chapters.map((ch) => (
                        <button
                            key={ch.id}
                            onClick={() => onChapterChange(ch.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "7px 10px",
                                borderRadius: 6,
                                background:
                                    selectedChapterId === ch.id ? "rgba(43,191,120,0.09)" : "transparent",
                                color:
                                    selectedChapterId === ch.id ? "var(--green)" : "var(--text-secondary)",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 12.5,
                                fontFamily: "'Outfit', sans-serif",
                                fontWeight: selectedChapterId === ch.id ? 600 : 400,
                                textAlign: "left",
                                width: "100%",
                                gap: 8,
                            }}
                        >
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {ch.name}
                            </span>
                            {materialCounts[ch.id] !== undefined && (
                                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                                    {materialCounts[ch.id]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
