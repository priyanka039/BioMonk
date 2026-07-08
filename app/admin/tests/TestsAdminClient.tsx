"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import AlertBanner from "@/components/admin/AlertBanner";
import ConfirmModal from "@/components/admin/ConfirmModal";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import Pagination from "@/components/admin/Pagination";
import {
    getTests,
    createTest,
    extractTestQuestions,
    toggleTestStatus,
    archiveTest,
    type TestRow,
    type ExtractResult,
} from "../actions/tests";

type Batch = { id: string; name: string };
type Chapter = { id: string; name: string; class_level: string; batch_id?: string };
type Page = { items: TestRow[]; total: number; page: number };

const DRAFT_KEY = "biomonk_test_draft";

const emptyForm = {
    title: "",
    type: "chapter_test",
    subject: "",
    batch_id: "",
    chapter_id: "",
    duration_minutes: "60",
    marks_correct: "4",
    marks_wrong: "-1",
};

export default function TestsAdminClient({
    initial,
    batches,
    chapters,
}: {
    initial: Page;
    batches: Batch[];
    chapters: Chapter[];
}) {
    const [data, setData] = useState<Page>(initial);
    const [search, setSearch] = useState("");
    const [alert, setAlert] = useState<{ kind: "success" | "error" | "warning"; msg: string } | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState("");
    const [dupConfirm, setDupConfirm] = useState<string | null>(null);

    const [extractTarget, setExtractTarget] = useState<TestRow | null>(null);
    const [extractReport, setExtractReport] = useState<ExtractResult["report"] | null>(null);
    const [extractError, setExtractError] = useState("");
    const extractFileRef = useRef<HTMLInputElement>(null);

    const [archiveTarget, setArchiveTarget] = useState<TestRow | null>(null);

    // ── Autosave the create form to localStorage ──
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) setForm({ ...emptyForm, ...JSON.parse(saved) });
        } catch {
            /* ignore */
        }
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        } catch {
            /* ignore */
        }
    }, [form]);

    function set<K extends keyof typeof form>(key: K, value: string) {
        setForm((f) => {
            const next = { ...f, [key]: value };
            if (key === "batch_id") next.chapter_id = "";
            return next;
        });
    }

    const batchChapters = chapters.filter(
        (c) => !form.batch_id || c.batch_id === form.batch_id
    );

    async function refresh(page = data.page, q = search) {
        const res = await getTests(page, q);
        if (res.success && res.data) setData(res.data);
    }

    async function doCreate(allowDuplicate: boolean) {
        setFormError("");
        const res = await createTest(
            {
                title: form.title,
                type: form.type,
                subject: form.subject || undefined,
                batch_id: form.batch_id,
                chapter_id: form.chapter_id || undefined,
                duration_minutes: Number(form.duration_minutes),
                marks_correct: Number(form.marks_correct),
                marks_wrong: Number(form.marks_wrong),
            },
            allowDuplicate
        );
        if (!res.success) {
            if (res.duplicate) {
                setDupConfirm(res.error);
                return;
            }
            setFormError(res.error);
            return;
        }
        setDupConfirm(null);
        setCreateOpen(false);
        setForm(emptyForm);
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setAlert({ kind: "success", msg: "Test created. Upload a PDF and extract questions, then activate it." });
        await refresh(1, "");
    }

    async function doExtract() {
        setExtractError("");
        setExtractReport(null);
        const file = extractFileRef.current?.files?.[0];
        if (!file) return setExtractError("Please choose a PDF file.");
        if (!extractTarget) return;

        const fd = new FormData();
        fd.append("file", file);
        const res = await extractTestQuestions(extractTarget.id, fd);
        if (res.report) setExtractReport(res.report);
        if (!res.success) {
            setExtractError(res.error || "Extraction failed.");
            return;
        }
        setAlert({
            kind: "success",
            msg: `Extracted ${res.report?.extracted ?? 0} questions. Review the report, then activate the test.`,
        });
        await refresh();
    }

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Tests</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                        Create a test, upload its PDF, extract questions, then activate.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => { setFormError(""); setCreateOpen(true); }}>
                    + New Test
                </button>
            </div>

            {alert && <AlertBanner kind={alert.kind} message={alert.msg} onClose={() => setAlert(null)} />}

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <input
                    className="input-base"
                    placeholder="Search by title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && refresh(1, search)}
                    style={{ maxWidth: 320 }}
                />
                <button className="btn btn-secondary" onClick={() => refresh(1, search)}>Search</button>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
                {data.items.length === 0 ? (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                        No tests yet — click <strong style={{ color: "var(--text-secondary)" }}>New Test</strong> to create one.
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                                <th style={th}>Title</th>
                                <th style={th}>Type</th>
                                <th style={th}>Batch</th>
                                <th style={th}>Questions</th>
                                <th style={th}>Status</th>
                                <th style={{ ...th, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((t) => (
                                <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ ...td, color: "var(--text-primary)", fontWeight: 500 }}>
                                        {t.title}
                                        {t.current_version && (
                                            <span style={{ color: "var(--text-muted)", fontSize: 11.5, marginLeft: 6 }}>v{t.current_version}</span>
                                        )}
                                    </td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>
                                        {t.type.replace("_", " ")}
                                    </td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>{t.batch_name || "—"}</td>
                                    <td style={{ ...td, color: t.question_count ? "var(--text-secondary)" : "var(--gold)" }}>
                                        {t.question_count}
                                    </td>
                                    <td style={td}>
                                        <Tag variant={t.is_active ? "green" : "muted"}>
                                            {t.is_active ? "Active" : "Draft"}
                                        </Tag>
                                    </td>
                                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                                        <button
                                            className="btn btn-ghost"
                                            style={miniBtn}
                                            onClick={() => { setExtractTarget(t); setExtractReport(null); setExtractError(""); if (extractFileRef.current) extractFileRef.current.value = ""; }}
                                        >
                                            {t.question_count ? "Re-extract" : "Upload PDF"}
                                        </button>
                                        <ToggleButton test={t} onDone={(m) => { setAlert(m); refresh(); }} />
                                        <button
                                            className="btn btn-ghost"
                                            style={{ ...miniBtn, color: "var(--red)" }}
                                            onClick={() => setArchiveTarget(t)}
                                        >
                                            Archive
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Pagination page={data.page} total={data.total} onPage={(p) => refresh(p, search)} />

            {/* Create test */}
            <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Test" maxWidth={560}>
                <AlertBanner kind="error" message={formError} onClose={() => setFormError("")} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                    Your draft is saved automatically — you won&apos;t lose it if you close this.
                </p>
                <FormField label="Title" htmlFor="t-title">
                    <input id="t-title" className="input-base" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Chapter 5 — Cell Cycle" />
                </FormField>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <FormField label="Type" htmlFor="t-type">
                            <select id="t-type" className="input-base" value={form.type} onChange={(e) => set("type", e.target.value)}>
                                <option value="chapter_test">Chapter Test</option>
                                <option value="full_mock">Full Mock</option>
                                <option value="dpp">DPP</option>
                            </select>
                        </FormField>
                    </div>
                    <div style={{ flex: 1 }}>
                        <FormField label="Subject (optional)" htmlFor="t-subject">
                            <select id="t-subject" className="input-base" value={form.subject} onChange={(e) => set("subject", e.target.value)}>
                                <option value="">—</option>
                                <option value="biology">Biology</option>
                                <option value="chemistry">Chemistry</option>
                                <option value="physics">Physics</option>
                            </select>
                        </FormField>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <FormField label="Batch" htmlFor="t-batch">
                            <select id="t-batch" className="input-base" value={form.batch_id} onChange={(e) => set("batch_id", e.target.value)}>
                                <option value="">Select a batch…</option>
                                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </FormField>
                    </div>
                    <div style={{ flex: 1 }}>
                        <FormField label="Chapter (optional)" htmlFor="t-chapter">
                            <select id="t-chapter" className="input-base" value={form.chapter_id} onChange={(e) => set("chapter_id", e.target.value)} disabled={!form.batch_id}>
                                <option value="">—</option>
                                {batchChapters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.class_level})</option>)}
                            </select>
                        </FormField>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <FormField label="Duration (min)" htmlFor="t-dur">
                            <input id="t-dur" type="number" min={1} className="input-base" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
                        </FormField>
                    </div>
                    <div style={{ flex: 1 }}>
                        <FormField label="Marks / correct" htmlFor="t-mc">
                            <input id="t-mc" type="number" className="input-base" value={form.marks_correct} onChange={(e) => set("marks_correct", e.target.value)} />
                        </FormField>
                    </div>
                    <div style={{ flex: 1 }}>
                        <FormField label="Marks / wrong" htmlFor="t-mw">
                            <input id="t-mw" type="number" className="input-base" value={form.marks_wrong} onChange={(e) => set("marks_wrong", e.target.value)} />
                        </FormField>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
                    <SubmitButton onClick={() => doCreate(false)}>Create Test</SubmitButton>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={!!dupConfirm}
                title="Possible duplicate"
                message={dupConfirm || ""}
                confirmLabel="Create anyway"
                confirmVariant="primary"
                onConfirm={() => doCreate(true)}
                onCancel={() => setDupConfirm(null)}
            />

            {/* Extract PDF */}
            <Modal isOpen={!!extractTarget} onClose={() => setExtractTarget(null)} title={`Extract questions — ${extractTarget?.title ?? ""}`} maxWidth={560}>
                <AlertBanner kind="error" message={extractError} onClose={() => setExtractError("")} />
                <div
                    style={{
                        fontSize: 12.5,
                        color: "var(--gold)",
                        background: "rgba(224,156,44,0.08)",
                        border: "1px solid rgba(224,156,44,0.25)",
                        borderRadius: 6,
                        padding: "10px 12px",
                        marginBottom: 14,
                    }}
                >
                    Images, tables, equations, and multi-column PDFs may not parse cleanly — check the report before activating.
                </div>
                <FormField label="Question PDF" htmlFor="ex-file" hint="PDF only, up to 50 MB. Re-extracting creates a new version and never changes past attempts.">
                    <input id="ex-file" ref={extractFileRef} type="file" accept="application/pdf" className="input-base" />
                </FormField>

                {extractReport && (
                    <div className="card" style={{ padding: 14, marginBottom: 14, background: "var(--surface-2)" }}>
                        <div style={{ fontSize: 13, marginBottom: 6 }}>
                            <strong style={{ color: "var(--green)" }}>{extractReport.extracted}</strong> questions extracted
                            <span style={{ color: "var(--text-muted)" }}> · format: {extractReport.format}</span>
                        </div>
                        {extractReport.failed.length > 0 && (
                            <div style={{ fontSize: 12.5, color: "var(--gold)" }}>
                                {extractReport.failed.length} needed placeholders: {extractReport.failed.map((f) => `Q${f.num}`).join(", ")}
                            </div>
                        )}
                        {extractReport.unmatched.length > 0 && (
                            <div style={{ fontSize: 12.5, color: "var(--red)" }}>
                                No answer for: {extractReport.unmatched.map((n) => `Q${n}`).join(", ")}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                    <button className="btn btn-ghost" onClick={() => setExtractTarget(null)}>Close</button>
                    <SubmitButton onClick={doExtract}>Extract</SubmitButton>
                </div>
            </Modal>

            {/* Archive */}
            <ConfirmModal
                isOpen={!!archiveTarget}
                title="Archive test"
                message={`Archive "${archiveTarget?.title}"? It will be deactivated and hidden from students. You can restore it from the Archive tab.`}
                confirmLabel="Archive"
                onConfirm={async () => {
                    if (!archiveTarget) return;
                    const res = await archiveTest(archiveTarget.id);
                    setArchiveTarget(null);
                    if (res.success) {
                        setAlert({ kind: "success", msg: "Test archived." });
                        await refresh();
                    } else setAlert({ kind: "error", msg: res.error });
                }}
                onCancel={() => setArchiveTarget(null)}
            />
        </div>
    );
}

function ToggleButton({
    test,
    onDone,
}: {
    test: TestRow;
    onDone: (m: { kind: "success" | "error"; msg: string }) => void;
}) {
    return (
        <SubmitButton
            variant="ghost"
            style={miniBtn}
            onClick={async () => {
                const res = await toggleTestStatus(test.id);
                if (res.success) {
                    onDone({ kind: "success", msg: test.is_active ? "Test deactivated." : "Test activated — students can see it now." });
                } else {
                    onDone({ kind: "error", msg: res.error });
                }
            }}
        >
            {test.is_active ? "Deactivate" : "Activate"}
        </SubmitButton>
    );
}

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { fontSize: 12.5, padding: "5px 10px", marginLeft: 6 };
