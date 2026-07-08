"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import Pagination from "@/components/admin/Pagination";
import { formatDate } from "@/lib/format";
import {
    getBatches,
    createBatch,
    updateBatch,
    toggleBatchActive,
    type BatchRow,
} from "../actions/batches";

type Page = { items: BatchRow[]; total: number; page: number };

const emptyForm = { name: "", description: "", start_date: "", end_date: "" };

export default function BatchesAdminClient({ initial }: { initial: Page }) {
    const router = useRouter();
    const [data, setData] = useState<Page>(initial);
    const [alert, setAlert] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState("");

    const [editTarget, setEditTarget] = useState<BatchRow | null>(null);
    const [editForm, setEditForm] = useState(emptyForm);

    async function refresh(page = data.page) {
        const res = await getBatches(page);
        if (res.success && res.data) setData(res.data);
    }

    async function doCreate() {
        setFormError("");
        const res = await createBatch(form.name, form.description, form.start_date, form.end_date);
        if (!res.success) return setFormError(res.error);
        setCreateOpen(false);
        setForm(emptyForm);
        setAlert({ kind: "success", msg: "Batch created." });
        await refresh(1);
    }

    function openEdit(b: BatchRow) {
        setEditTarget(b);
        setEditForm({
            name: b.name,
            description: b.description || "",
            start_date: b.start_date,
            end_date: b.end_date,
        });
    }

    async function doEdit() {
        if (!editTarget) return;
        setFormError("");
        const res = await updateBatch(
            editTarget.id,
            editForm.name,
            editForm.description,
            editForm.start_date,
            editForm.end_date
        );
        if (!res.success) return setFormError(res.error);
        setEditTarget(null);
        setAlert({ kind: "success", msg: "Batch updated." });
        await refresh();
    }

    async function doToggle(b: BatchRow, e: React.MouseEvent) {
        e.stopPropagation();
        const res = await toggleBatchActive(b.id);
        if (res.success) {
            setAlert({ kind: "success", msg: b.is_active ? "Batch deactivated." : "Batch activated." });
            await refresh();
        }
    }

    const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Batches</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                        Manage coaching batches, exam dates, and view batch dashboards.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => { setFormError(""); setCreateOpen(true); }}>
                    + New Batch
                </button>
            </div>

            {alert && <AlertBanner kind={alert.kind} message={alert.msg} onClose={() => setAlert(null)} />}

            <div className="card" style={{ overflow: "hidden" }}>
                {data.items.length === 0 ? (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                        No batches yet — create your first batch (e.g. NEET 2027).
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                                <th style={td}>Name</th>
                                <th style={td}>NEET exam date</th>
                                <th style={td}>Students</th>
                                <th style={td}>Chapters</th>
                                <th style={td}>Tests</th>
                                <th style={td}>Status</th>
                                <th style={{ ...td, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((b) => (
                                <tr
                                    key={b.id}
                                    style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                                    onClick={() => router.push(`/admin/batches/${b.id}`)}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                    <td style={{ ...td, fontWeight: 600 }}>{b.name}</td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>{formatDate(b.end_date)}</td>
                                    <td style={td}>{b.student_count ?? 0}</td>
                                    <td style={td}>{b.chapter_count ?? 0}</td>
                                    <td style={td}>{b.test_count ?? 0}</td>
                                    <td style={td}>
                                        <Tag variant={b.is_active ? "green" : "muted"}>{b.is_active ? "Active" : "Inactive"}</Tag>
                                    </td>
                                    <td style={{ ...td, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                                        <button className="btn btn-ghost" style={{ fontSize: 12, marginRight: 8 }} onClick={() => openEdit(b)}>Edit</button>
                                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={(e) => doToggle(b, e)}>
                                            {b.is_active ? "Deactivate" : "Activate"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Pagination page={data.page} total={data.total} onPage={refresh} />

            <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Batch">
                <BatchForm form={form} setForm={setForm} error={formError} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                    <SubmitButton onClick={doCreate}>Create Batch</SubmitButton>
                </div>
            </Modal>

            <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Batch">
                <BatchForm form={editForm} setForm={setEditForm} error={formError} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                    <SubmitButton onClick={doEdit}>Save Changes</SubmitButton>
                </div>
            </Modal>
        </div>
    );
}

function BatchForm({
    form,
    setForm,
    error,
}: {
    form: typeof emptyForm;
    setForm: (f: typeof emptyForm) => void;
    error: string;
}) {
    return (
        <>
            {error && <AlertBanner kind="error" message={error} />}
            <FormField label="Batch name" htmlFor="b-name">
                <input id="b-name" className="input-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="NEET 2027" />
            </FormField>
            <FormField label="Description" htmlFor="b-desc">
                <input id="b-desc" className="input-base" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <FormField label="Coaching start date" htmlFor="b-start">
                <input id="b-start" type="date" className="input-base" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </FormField>
            <FormField label="NEET exam date" htmlFor="b-end" hint="Drives the student countdown on their dashboard.">
                <input id="b-end" type="date" className="input-base" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </FormField>
        </>
    );
}
