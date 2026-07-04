"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import Pagination from "@/components/admin/Pagination";
import { formatDate } from "@/lib/format";
import {
    getStudents,
    createStudentUser,
    updateStudent,
    resetStudentPassword,
    getStudentAttempts,
    type StudentRow,
} from "../actions/students";

type Batch = { id: string; name: string; is_active: boolean };
type Page = { items: StudentRow[]; total: number; page: number };
type Attempt = {
    id: string;
    score: number | null;
    max_score: number | null;
    submitted_at: string | null;
    is_completed: boolean;
    test: { title: string } | { title: string }[] | null;
};

export default function StudentsAdminClient({
    initial,
    batches,
}: {
    initial: Page;
    batches: Batch[];
}) {
    const [data, setData] = useState<Page>(initial);
    const [search, setSearch] = useState("");
    const [alert, setAlert] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [batchId, setBatchId] = useState("");
    const [formError, setFormError] = useState("");

    const [editTarget, setEditTarget] = useState<StudentRow | null>(null);
    const [editName, setEditName] = useState("");
    const [editBatch, setEditBatch] = useState("");

    const [pwTarget, setPwTarget] = useState<StudentRow | null>(null);
    const [newPw, setNewPw] = useState("");

    const [scoresTarget, setScoresTarget] = useState<StudentRow | null>(null);
    const [attempts, setAttempts] = useState<Attempt[] | null>(null);

    async function refresh(page = data.page, q = search) {
        const res = await getStudents(page, q);
        if (res.success && res.data) setData(res.data);
    }

    async function doAdd() {
        setFormError("");
        const res = await createStudentUser(name, email, password, batchId);
        if (!res.success) return setFormError(res.error);
        setAddOpen(false);
        setName(""); setEmail(""); setPassword(""); setBatchId("");
        setAlert({ kind: "success", msg: "Student created — they can now log in." });
        await refresh(1, "");
    }

    async function openScores(s: StudentRow) {
        setScoresTarget(s);
        setAttempts(null);
        const res = await getStudentAttempts(s.id);
        setAttempts(res.success && res.data ? (res.data as Attempt[]) : []);
    }

    function testTitle(a: Attempt): string {
        const t = Array.isArray(a.test) ? a.test[0] : a.test;
        return t?.title || "Test";
    }

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Students</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                        Create accounts, assign batches, view scores.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => { setFormError(""); setAddOpen(true); }}>
                    + Add Student
                </button>
            </div>

            {alert && <AlertBanner kind={alert.kind} message={alert.msg} onClose={() => setAlert(null)} />}

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <input
                    className="input-base"
                    placeholder="Search by name..."
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
                        No students yet — click <strong style={{ color: "var(--text-secondary)" }}>Add Student</strong> to enroll one.
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                                <th style={th}>Name</th>
                                <th style={th}>Email</th>
                                <th style={th}>Batch</th>
                                <th style={th}>Tests</th>
                                <th style={th}>Avg</th>
                                <th style={{ ...th, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((s) => (
                                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ ...td, color: "var(--text-primary)", fontWeight: 500 }}>{s.full_name || "—"}</td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>{s.email || "—"}</td>
                                    <td style={{ ...td, color: s.batch_name ? "var(--text-secondary)" : "var(--red)" }}>
                                        {s.batch_name || "No batch"}
                                    </td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>{s.attempts}</td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>{s.avg_score ?? "—"}</td>
                                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                                        <button className="btn btn-ghost" style={miniBtn} onClick={() => openScores(s)}>Scores</button>
                                        <button className="btn btn-ghost" style={miniBtn} onClick={() => { setEditTarget(s); setEditName(s.full_name); setEditBatch(s.batch_id || ""); }}>Edit</button>
                                        <button className="btn btn-ghost" style={miniBtn} onClick={() => { setPwTarget(s); setNewPw(""); }}>Password</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Pagination page={data.page} total={data.total} onPage={(p) => refresh(p, search)} />

            {/* Add student */}
            <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Student">
                <AlertBanner kind="error" message={formError} onClose={() => setFormError("")} />
                <FormField label="Full name" htmlFor="s-name">
                    <input id="s-name" className="input-base" value={name} onChange={(e) => setName(e.target.value)} />
                </FormField>
                <FormField label="Email" htmlFor="s-email">
                    <input id="s-email" type="email" className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                <FormField label="Temporary password" htmlFor="s-pw" hint="At least 8 characters. Share it with the student.">
                    <input id="s-pw" className="input-base" value={password} onChange={(e) => setPassword(e.target.value)} />
                </FormField>
                <FormField label="Batch" htmlFor="s-batch">
                    <select id="s-batch" className="input-base" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                        <option value="">Select a batch…</option>
                        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </FormField>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                    <SubmitButton onClick={doAdd}>Create Student</SubmitButton>
                </div>
            </Modal>

            {/* Edit student */}
            <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Student">
                <FormField label="Full name" htmlFor="e-name">
                    <input id="e-name" className="input-base" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </FormField>
                <FormField label="Batch" htmlFor="e-batch">
                    <select id="e-batch" className="input-base" value={editBatch} onChange={(e) => setEditBatch(e.target.value)}>
                        <option value="">Select a batch…</option>
                        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </FormField>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
                    <SubmitButton onClick={async () => {
                        if (!editTarget) return;
                        const res = await updateStudent(editTarget.id, editName, editBatch);
                        if (res.success) {
                            setEditTarget(null);
                            setAlert({ kind: "success", msg: "Student updated." });
                            await refresh();
                        } else setAlert({ kind: "error", msg: res.error });
                    }}>Save</SubmitButton>
                </div>
            </Modal>

            {/* Reset password */}
            <Modal isOpen={!!pwTarget} onClose={() => setPwTarget(null)} title="Reset Password">
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
                    Set a new password for <strong>{pwTarget?.full_name}</strong>. Share it with them.
                </p>
                <FormField label="New password" htmlFor="pw-new" hint="At least 8 characters.">
                    <input id="pw-new" className="input-base" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                </FormField>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setPwTarget(null)}>Cancel</button>
                    <SubmitButton onClick={async () => {
                        if (!pwTarget) return;
                        const res = await resetStudentPassword(pwTarget.id, newPw);
                        if (res.success) {
                            setPwTarget(null);
                            setAlert({ kind: "success", msg: "Password reset." });
                        } else setAlert({ kind: "error", msg: res.error });
                    }}>Reset Password</SubmitButton>
                </div>
            </Modal>

            {/* Scores drill-down */}
            <Modal isOpen={!!scoresTarget} onClose={() => setScoresTarget(null)} title={`${scoresTarget?.full_name} — Scores`} maxWidth={560}>
                {attempts === null ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
                ) : attempts.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No completed attempts yet.</p>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                                <th style={th}>Test</th>
                                <th style={th}>Score</th>
                                <th style={th}>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attempts.map((a) => (
                                <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ ...td, color: "var(--text-primary)" }}>{testTitle(a)}</td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>
                                        {a.score ?? "—"}{a.max_score ? ` / ${a.max_score}` : ""}
                                    </td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>
                                        {a.submitted_at ? formatDate(a.submitted_at) : "In progress"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Modal>
        </div>
    );
}

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { fontSize: 12.5, padding: "5px 10px", marginLeft: 6 };
