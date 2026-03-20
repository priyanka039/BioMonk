"use client";

import { useState, useMemo } from "react";
import { StudyMaterial, Chapter, MaterialType } from "@/lib/types";
import ChapterFilter from "@/components/materials/ChapterFilter";
import MaterialCard from "@/components/materials/MaterialCard";

interface MaterialsBrowserProps {
    chapters: Chapter[];
    materials: (StudyMaterial & { chapter?: Chapter })[];
}

export default function MaterialsBrowser({ chapters, materials }: MaterialsBrowserProps) {
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<MaterialType | "all">("all");

    // Material counts per chapter
    const materialCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const m of materials) {
            counts[m.chapter_id] = (counts[m.chapter_id] || 0) + 1;
        }
        return counts;
    }, [materials]);

    // Filtered materials
    const filtered = useMemo(() => {
        return materials.filter((m) => {
            const chapterMatch = selectedChapterId === null || m.chapter_id === selectedChapterId;
            const typeMatch = selectedType === "all" || m.type === selectedType;
            return chapterMatch && typeMatch;
        });
    }, [materials, selectedChapterId, selectedType]);

    return (
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            {/* Filter sidebar */}
            <ChapterFilter
                chapters={chapters}
                selectedChapterId={selectedChapterId}
                selectedType={selectedType}
                materialCounts={materialCounts}
                onChapterChange={setSelectedChapterId}
                onTypeChange={setSelectedType}
            />

            {/* Material grid */}
            <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {filtered.length} {filtered.length === 1 ? "material" : "materials"} found
                    </p>
                </div>

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
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ margin: "0 auto 14px" }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 500 }}>No materials found</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>
                            Try changing your filters or check back later.
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 16,
                        }}
                    >
                        {filtered.map((m) => (
                            <MaterialCard key={m.id} material={m} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
