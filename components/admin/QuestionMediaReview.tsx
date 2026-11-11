"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import QuestionMediaImage from "@/components/tests/QuestionMediaImage";
import {
    getTestQuestionsForReview,
    uploadQuestionMedia,
    clearQuestionMedia,
    type QuestionMediaSlot,
} from "@/app/admin/actions/tests";
import { isPlaceholderOption, isPlaceholderStem } from "@/lib/question-media";

type QRow = {
    id: string;
    order_index: number;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    question_image_path: string | null;
    option_a_image_path: string | null;
    option_b_image_path: string | null;
    option_c_image_path: string | null;
    option_d_image_path: string | null;
};

const SLOTS: { slot: QuestionMediaSlot; label: string; textKey: keyof QRow; imgKey: keyof QRow }[] = [
    { slot: "stem", label: "Stem / diagram", textKey: "question_text", imgKey: "question_image_path" },
    { slot: "a", label: "Option A", textKey: "option_a", imgKey: "option_a_image_path" },
    { slot: "b", label: "Option B", textKey: "option_b", imgKey: "option_b_image_path" },
    { slot: "c", label: "Option C", textKey: "option_c", imgKey: "option_c_image_path" },
    { slot: "d", label: "Option D", textKey: "option_d", imgKey: "option_d_image_path" },
];

export default function QuestionMediaReview({
    testId,
    testTitle,
    open,
    onClose,
}: {
    testId: string;
    testTitle: string;
    open: boolean;
    onClose: () => void;
}) {
    const [questions, setQuestions] = useState<QRow[]>([]);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

    async function load() {
        setError("");
        const res = await getTestQuestionsForReview(testId);
        if (!res.success) {
            setError(res.error || "Could not load questions.");
            return;
        }
        setQuestions((res.data?.questions as QRow[]) || []);
    }

    useEffect(() => {
        if (open) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, testId]);

    async function onUpload(q: QRow, slot: QuestionMediaSlot) {
        const key = `${q.id}:${slot}`;
        const input = fileRefs.current[key];
        const file = input?.files?.[0];
        if (!file) {
            setError("Choose an image file first.");
            return;
        }
        setBusyId(key);
        setError("");
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadQuestionMedia(q.id, slot, fd);
        setBusyId(null);
        if (!res.success) {
            setError(res.error || "Upload failed.");
            return;
        }
        if (input) input.value = "";
        await load();
    }

    async function onClear(q: QRow, slot: QuestionMediaSlot) {
        const key = `${q.id}:${slot}`;
        setBusyId(key);
        setError("");
        const res = await clearQuestionMedia(q.id, slot);
        setBusyId(null);
        if (!res.success) {
            setError(res.error || "Could not clear image.");
            return;
        }
        await load();
    }

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Review media — ${testTitle}`}
            maxWidth={720}
        >
            <AlertBanner kind="error" message={error} onClose={() => setError("")} />
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
                Auto-extract attaches screenshots when text is missing. Upload or replace PNG/JPG for any stem or option.
            </p>

            {questions.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No questions yet. Extract a PDF first.</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: "65vh", overflowY: "auto" }}>
                    {questions.map((q) => {
                        const needs =
                            isPlaceholderStem(q.question_text) ||
                            [q.option_a, q.option_b, q.option_c, q.option_d].some(isPlaceholderOption);
                        return (
                            <div
                                key={q.id}
                                className="card"
                                style={{
                                    padding: 14,
                                    borderColor: needs ? "rgba(224,156,44,0.35)" : undefined,
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                    <strong style={{ fontSize: 14 }}>Q{q.order_index}</strong>
                                    {needs && (
                                        <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>
                                            Needs media check
                                        </span>
                                    )}
                                </div>
                                {SLOTS.map(({ slot, label, textKey, imgKey }) => {
                                    const text = String(q[textKey] || "");
                                    const img = q[imgKey] as string | null;
                                    const key = `${q.id}:${slot}`;
                                    return (
                                        <div
                                            key={slot}
                                            style={{
                                                marginBottom: 12,
                                                paddingBottom: 12,
                                                borderBottom: "1px solid var(--border-soft)",
                                            }}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                                                {label}
                                            </div>
                                            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>
                                                {text.slice(0, 160)}
                                                {text.length > 160 ? "…" : ""}
                                            </p>
                                            <QuestionMediaImage path={img} alt={label} maxHeight={140} />
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                                    ref={(el) => {
                                                        fileRefs.current[key] = el;
                                                    }}
                                                    style={{ fontSize: 12, maxWidth: 220 }}
                                                />
                                                <SubmitButton
                                                    onClick={() => onUpload(q, slot)}
                                                    disabled={busyId === key}
                                                    style={{ fontSize: 12, padding: "6px 10px" }}
                                                >
                                                    {busyId === key ? "Saving…" : img ? "Replace" : "Upload"}
                                                </SubmitButton>
                                                {img && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        style={{ fontSize: 12, padding: "6px 10px", color: "var(--red)" }}
                                                        onClick={() => onClear(q, slot)}
                                                        disabled={busyId === key}
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={onClose}>
                    Close
                </button>
            </div>
        </Modal>
    );
}
