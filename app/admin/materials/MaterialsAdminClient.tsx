"use client";

import { useState, useRef, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import AlertBanner from "@/components/admin/AlertBanner";
import ConfirmModal from "@/components/admin/ConfirmModal";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import Pagination from "@/components/admin/Pagination";
import { formatDate } from "@/lib/format";
import {
    getMaterials,
    getChapters,
    uploadStudyMaterial,
    archiveMaterial,
    type MaterialRow,
} from "../actions/materials";

type Chapter = { id: string; name: string; class_level: string; batch_id?: string };
type Batch = { id: string; name: string; is_active: boolean };
type Page = { items: MaterialRow[]; total: number; page: number };

const TYPE_META: Record<string, { label: string; variant: "green" | "gold" | "red" | "blue" }> = {
    notes: { label: "Notes", variant: "green" },
    mindmap: { label: "Mind Map", variant: "gold" },
    pyq: { label: "PYQ", variant: "red" },
    formula_sheet: { label: "Formula Sheet", variant: "blue" },
};

export default function MaterialsAdminClient({
    initial,
    chapters,
    batches,
}: {
    initial: Page;
    chapters: Chapter[];
    batches: Batch[];
}) {
    const [data, setData] = useState<Page>(initial);
    const [search, setSearch] = useState("");
    const [alert, setAlert] = useState<{ kind: "success" | "error" | "warning"; msg: string } | null>(null);

    const [uploadOpen, setUploadOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [type, setType] = useState("notes");
    const [batchId, setBatchId] = useState("");
    const [chapterId, setChapterId] = useState("");
    const [allChapters, setAllChapters] = useState(chapters);
    const [formError, setFormError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const filteredChapters = useMemo(
        () => (batchId ? allChapters.filter((c) => c.batch_id === batchId) : allChapters),
        [allChapters, batchId]
    );

    const [dupConfirm, setDupConfirm] = useState<{ open: boolean; msg: string } | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<MaterialRow | null>(null);

    async function refresh(page = data.page, q = search) {
        const res = await getMaterials(page, q);
        if (res.success && res.data) setData(res.data);
    }

    function resetForm() {
        setTitle("");
        setType("notes");
        setBatchId("");
        setChapterId("");
        setFormError("");
        if (fileRef.current) fileRef.current.value = "";
    }

    async function onBatchChange(bid: string) {
        setBatchId(bid);
        setChapterId("");
        if (bid) {
            const res = await getChapters(bid);
            if (res.success && res.data) setAllChapters((prev) => {
                const ids = new Set(res.data!.map((c) => c.id));
                const rest = prev.filter((c) => !ids.has(c.id));
                return [...rest, ...res.data!];
            });
        }
    }

    async function doUpload(allowDuplicate: boolean) {
        setFormError("");
        const file = fileRef.current?.files?.[0];
        if (!file) return setFormError("Please choose a PDF file.");
        if (!title.trim()) return setFormError("Please enter a title.");
        if (!chapterId) return setFormError("Please select a chapter.");

        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", title.trim());
        fd.append("type", type);
        fd.append("chapter_id", chapterId);

        const res = await uploadStudyMaterial(fd, allowDuplicate);
        if (!res.success) {
            if (res.duplicate) {
                setDupConfirm({ open: true, msg: res.error });
                return;
            }
            setFormError(res.error);
            return;
        }
        setDupConfirm(null);
        setUploadOpen(false);
        resetForm();
        setAlert({ kind: "success", msg: res.warning || "Material uploaded — students can see it now." });
        await refresh(1, "");
    }

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Study Materials</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                        PDFs students can view and download.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setUploadOpen(true); }}>
                    + Upload PDF
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
                        No materials yet — click <strong style={{ color: "var(--text-secondary)" }}>Upload PDF</strong> to add your first one.
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                                <th style={th}>Title</th>
                                <th style={th}>Chapter</th>
                                <th style={th}>Type</th>
                                <th style={th}>Size</th>
                                <th style={th}>Added</th>
                                <th style={{ ...th, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((m) => (
                                <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={td}>
                                        <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{m.title}</div>
                                        {m.original_filename && (
                                            <div style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{m.original_filename}</div>
                                        )}
                                    </td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>{m.chapter?.name || "—"}</td>
                                    <td style={td}>
                                        <Tag variant={TYPE_META[m.type]?.variant || "muted"}>
                                            {TYPE_META[m.type]?.label || m.type}
                                        </Tag>
                                    </td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>
                                        {m.file_size_kb ? `${(m.file_size_kb / 1024).toFixed(1)} MB` : "—"}
                                    </td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>
                                        {formatDate(m.created_at)}
                                    </td>
                                    <td style={{ ...td, textAlign: "right" }}>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ fontSize: 12.5, padding: "5px 10px", color: "var(--red)" }}
                                            onClick={() => setArchiveTarget(m)}
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

            {/* Upload modal */}
            <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Study Material">
                <AlertBanner kind="error" message={formError} onClose={() => setFormError("")} />
                <FormField label="PDF file" htmlFor="mat-file" hint="PDF only, up to 50 MB.">
                    <input id="mat-file" ref={fileRef} type="file" accept="application/pdf" className="input-base" />
                </FormField>
                <FormField label="Title" htmlFor="mat-title">
                    <input id="mat-title" className="input-base" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cell Biology — Chapter Notes" />
                </FormField>
                <FormField label="Type" htmlFor="mat-type">
                    <select id="mat-type" className="input-base" value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="notes">Notes</option>
                        <option value="mindmap">Mind Map</option>
                        <option value="pyq">PYQ</option>
                        <option value="formula_sheet">Formula Sheet</option>
                    </select>
                </FormField>
                <FormField label="Batch" htmlFor="mat-batch">
                    <select id="mat-batch" className="input-base" value={batchId} onChange={(e) => onBatchChange(e.target.value)}>
                        <option value="">Select a batch…</option>
                        {batches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </FormField>
                <FormField label="Chapter" htmlFor="mat-chapter">
                    <select id="mat-chapter" className="input-base" value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!batchId}>
                        <option value="">Select a chapter…</option>
                        {filteredChapters.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.class_level})</option>
                        ))}
                    </select>
                </FormField>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setUploadOpen(false)}>Cancel</button>
                    <SubmitButton onClick={() => doUpload(false)}>Upload</SubmitButton>
                </div>
            </Modal>

            {/* Duplicate confirm */}
            <ConfirmModal
                isOpen={!!dupConfirm?.open}
                title="Possible duplicate"
                message={dupConfirm?.msg || ""}
                confirmLabel="Upload anyway"
                confirmVariant="primary"
                onConfirm={() => doUpload(true)}
                onCancel={() => setDupConfirm(null)}
            />

            {/* Archive confirm */}
            <ConfirmModal
                isOpen={!!archiveTarget}
                title="Archive material"
                message={`Archive "${archiveTarget?.title}"? Students will no longer see it. You can restore it from the Archive tab.`}
                confirmLabel="Archive"
                onConfirm={async () => {
                    if (!archiveTarget) return;
                    const res = await archiveMaterial(archiveTarget.id);
                    setArchiveTarget(null);
                    if (res.success) {
                        setAlert({ kind: "success", msg: "Material archived." });
                        await refresh();
                    } else {
                        setAlert({ kind: "error", msg: res.error });
                    }
                }}
                onCancel={() => setArchiveTarget(null)}
            />
        </div>
    );
}

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "top" };
