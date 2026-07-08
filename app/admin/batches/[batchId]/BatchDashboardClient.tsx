"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import StatCard from "@/components/dashboard/StatCard";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import { formatDate } from "@/lib/format";
import { updateBatch, type BatchDashboard } from "../../actions/batches";

function UsersIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    );
}
function BookIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>;
}
function LockIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
}
function FileIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function TestIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
}
function BellIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}
function CalendarIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}

const QUICK_LINKS = [
    { label: "Students", href: "/admin/students" },
    { label: "Chapters", href: "/admin/chapters", batchParam: true },
    { label: "Materials", href: "/admin/materials" },
    { label: "Tests", href: "/admin/tests" },
    { label: "Announcements", href: "/admin/announcements", batchParam: true },
];

export default function BatchDashboardClient({ initial }: { initial: BatchDashboard }) {
    const [dash, setDash] = useState(initial);
    const [editOpen, setEditOpen] = useState(false);
    const [form, setForm] = useState({
        name: initial.batch.name,
        description: initial.batch.description || "",
        start_date: initial.batch.start_date,
        end_date: initial.batch.end_date,
    });
    const [error, setError] = useState("");
    const [alert, setAlert] = useState<string | null>(null);

    const b = dash.batch;

    async function saveEdit() {
        setError("");
        const res = await updateBatch(b.id, form.name, form.description, form.start_date, form.end_date);
        if (!res.success) return setError(res.error);
        setDash((d) => ({
            ...d,
            batch: { ...d.batch, ...form },
            examCountdown: Math.max(0, Math.ceil((new Date(form.end_date).getTime() - Date.now()) / 86400000)),
        }));
        setEditOpen(false);
        setAlert("Batch updated.");
    }

    return (
        <div>
            <Link href="/admin/batches" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
                ← All batches
            </Link>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 12, marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26 }}>{b.name}</h2>
                        <Tag variant={b.is_active ? "green" : "muted"}>{b.is_active ? "Active" : "Inactive"}</Tag>
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                        NEET exam: {formatDate(b.end_date)} · Coaching since {formatDate(b.start_date)}
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={() => setEditOpen(true)}>Edit batch</button>
            </div>

            {alert && <AlertBanner kind="success" message={alert} onClose={() => setAlert(null)} />}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                <StatCard label="Students" value={dash.students} icon={<UsersIcon />} accentColor="var(--green)" />
                <StatCard label="Chapters" value={dash.chapters} subtext={`${dash.locked} locked`} icon={<BookIcon />} accentColor="var(--blue)" />
                <StatCard label="Locked" value={dash.locked} icon={<LockIcon />} accentColor="var(--gold)" />
                <StatCard label="Materials" value={dash.materials} icon={<FileIcon />} accentColor="var(--blue)" />
                <StatCard label="Tests" value={dash.tests} icon={<TestIcon />} accentColor="var(--green)" />
                <StatCard label="Announcements" value={dash.announcements} subtext="live" icon={<BellIcon />} accentColor="var(--gold)" />
                <StatCard label="Exam Countdown" value={dash.examCountdown} subtext="days remaining" icon={<CalendarIcon />} accentColor="var(--red)" />
            </div>

            <div className="card" style={{ padding: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    Quick actions
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {QUICK_LINKS.map((link) => (
                        <Link
                            key={link.label}
                            href={link.batchParam ? `${link.href}?batch=${b.id}` : link.href}
                            className="btn btn-secondary"
                            style={{ fontSize: 13 }}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>

            <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Batch">
                {error && <AlertBanner kind="error" message={error} />}
                <FormField label="Batch name" htmlFor="ed-name">
                    <input id="ed-name" className="input-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </FormField>
                <FormField label="Description" htmlFor="ed-desc">
                    <input id="ed-desc" className="input-base" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </FormField>
                <FormField label="Coaching start date" htmlFor="ed-start">
                    <input id="ed-start" type="date" className="input-base" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </FormField>
                <FormField label="NEET exam date" htmlFor="ed-end">
                    <input id="ed-end" type="date" className="input-base" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </FormField>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                    <SubmitButton onClick={saveEdit}>Save</SubmitButton>
                </div>
            </Modal>
        </div>
    );
}
