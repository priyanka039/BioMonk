"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Tag from "@/components/ui/Tag";
import Modal from "@/components/ui/Modal";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import {
    getChaptersForBatch,
    createChapter,
    updateChapter,
    toggleChapterLock,
    type ChapterRow,
} from "../actions/chapters";

type Batch = { id: string; name: string; is_active: boolean };

export default function ChaptersAdminClient({
    batches,
    initialBatchId,
    initialChapters,
}: {
    batches: Batch[];
    initialBatchId: string;
    initialChapters: ChapterRow[];
}) {
    const router = useRouter();
    const [batchId, setBatchId] = useState(initialBatchId);
    const [chapters, setChapters] = useState<ChapterRow[]>(initialChapters);
    const [alert, setAlert] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState("");
    const [classLevel, setClassLevel] = useState("XI");
    const [orderIndex, setOrderIndex] = useState("0");
    const [formError, setFormError] = useState("");

    const [editTarget, setEditTarget] = useState<ChapterRow | null>(null);

    async function loadChapters(bid: string) {
        if (!bid) { setChapters([]); return; }
        const res = await getChaptersForBatch(bid);
        setChapters(res.success && res.data ? res.data : []);
    }

    async function onBatchChange(bid: string) {
        setBatchId(bid);
        router.replace(`/admin/chapters?batch=${bid}`);
        await loadChapters(bid);
    }

    async function doAdd() {
        setFormError("");
        const res = await createChapter(batchId, name, classLevel, Number(orderIndex) || 0);
        if (!res.success) return setFormError(res.error);
        setAddOpen(false);
        setName("");
        setAlert({ kind: "success", msg: "Chapter added." });
        await loadChapters(batchId);
    }

    async function doEdit() {
        if (!editTarget) return;
        setFormError("");
        const res = await updateChapter(editTarget.id, name, classLevel, Number(orderIndex) || 0);
        if (!res.success) return setFormError(res.error);
        setEditTarget(null);
        setAlert({ kind: "success", msg: "Chapter updated." });
        await loadChapters(batchId);
    }

    async function doLock(ch: ChapterRow) {
        const res = await toggleChapterLock(ch.id);
        if (res.success) {
            setAlert({ kind: "success", msg: ch.is_locked ? "Chapter unlocked — students can access materials." : "Chapter locked — hidden from students." });
            await loadChapters(batchId);
        }
    }

    const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Chapters</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                        Control syllabus visibility per batch. Locked chapters hide materials from students.
                    </p>
                </div>
                <button className="btn btn-primary" disabled={!batchId} onClick={() => { setFormError(""); setAddOpen(true); }}>
                    + Add Chapter
                </button>
            </div>

            {alert && <AlertBanner kind={alert.kind} message={alert.msg} onClose={() => setAlert(null)} />}

            <div style={{ marginBottom: 16, maxWidth: 320 }}>
                <FormField label="Batch" htmlFor="ch-batch">
                    <select id="ch-batch" className="input-base" value={batchId} onChange={(e) => onBatchChange(e.target.value)}>
                        <option value="">Select batch…</option>
                        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </FormField>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
                {!batchId ? (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Select a batch to manage chapters.</div>
                ) : chapters.length === 0 ? (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>No chapters for this batch yet.</div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                                <th style={td}>#</th>
                                <th style={td}>Name</th>
                                <th style={td}>Class</th>
                                <th style={td}>Status</th>
                                <th style={{ ...td, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chapters.map((ch) => (
                                <tr key={ch.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={td}>{ch.order_index}</td>
                                    <td style={{ ...td, fontWeight: 500 }}>{ch.name}</td>
                                    <td style={td}>{ch.class_level}</td>
                                    <td style={td}>
                                        <Tag variant={ch.is_locked ? "red" : "green"}>{ch.is_locked ? "Locked" : "Open"}</Tag>
                                    </td>
                                    <td style={{ ...td, textAlign: "right" }}>
                                        <button className="btn btn-ghost" style={{ fontSize: 12, marginRight: 8 }} onClick={() => {
                                            setEditTarget(ch);
                                            setName(ch.name);
                                            setClassLevel(ch.class_level);
                                            setOrderIndex(String(ch.order_index));
                                        }}>Edit</button>
                                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => doLock(ch)}>
                                            {ch.is_locked ? "Unlock" : "Lock"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Chapter">
                {formError && <AlertBanner kind="error" message={formError} />}
                <ChapterForm name={name} setName={setName} classLevel={classLevel} setClassLevel={setClassLevel} orderIndex={orderIndex} setOrderIndex={setOrderIndex} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                    <SubmitButton onClick={doAdd}>Add</SubmitButton>
                </div>
            </Modal>

            <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Chapter">
                {formError && <AlertBanner kind="error" message={formError} />}
                <ChapterForm name={name} setName={setName} classLevel={classLevel} setClassLevel={setClassLevel} orderIndex={orderIndex} setOrderIndex={setOrderIndex} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                    <SubmitButton onClick={doEdit}>Save</SubmitButton>
                </div>
            </Modal>
        </div>
    );
}

function ChapterForm({
    name, setName, classLevel, setClassLevel, orderIndex, setOrderIndex,
}: {
    name: string; setName: (v: string) => void;
    classLevel: string; setClassLevel: (v: string) => void;
    orderIndex: string; setOrderIndex: (v: string) => void;
}) {
    return (
        <>
            <FormField label="Chapter name" htmlFor="cn">
                <input id="cn" className="input-base" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Class" htmlFor="cl">
                <select id="cl" className="input-base" value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
                    <option value="XI">XI</option>
                    <option value="XII">XII</option>
                </select>
            </FormField>
            <FormField label="Order index" htmlFor="oi">
                <input id="oi" type="number" className="input-base" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
            </FormField>
        </>
    );
}
