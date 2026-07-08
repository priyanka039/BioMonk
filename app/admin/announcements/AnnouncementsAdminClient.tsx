"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Tag from "@/components/ui/Tag";
import Modal from "@/components/ui/Modal";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import Pagination from "@/components/admin/Pagination";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { formatDate } from "@/lib/format";
import {
    getAnnouncements,
    createAnnouncement,
    archiveAnnouncement,
    type AnnouncementRow,
} from "../actions/announcements";

type Batch = { id: string; name: string; is_active: boolean };
type Page = { items: AnnouncementRow[]; total: number; page: number };

const STATUS_VARIANT: Record<string, "green" | "gold" | "muted"> = {
    live: "green",
    scheduled: "gold",
    expired: "muted",
};

export default function AnnouncementsAdminClient({
    initial,
    batches,
    filterBatchId,
}: {
    initial: Page;
    batches: Batch[];
    filterBatchId: string;
}) {
    const router = useRouter();
    const [data, setData] = useState<Page>(initial);
    const [batchFilter, setBatchFilter] = useState(filterBatchId);
    const [alert, setAlert] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [targetBatch, setTargetBatch] = useState("");
    const [priority, setPriority] = useState("normal");
    const [expiresAt, setExpiresAt] = useState("");
    const [formError, setFormError] = useState("");

    const [archiveTarget, setArchiveTarget] = useState<AnnouncementRow | null>(null);

    async function refresh(page = data.page, batch = batchFilter) {
        const res = await getAnnouncements(page, batch || undefined);
        if (res.success && res.data) setData(res.data);
    }

    function onFilterChange(bid: string) {
        setBatchFilter(bid);
        router.replace(bid ? `/admin/announcements?batch=${bid}` : "/admin/announcements");
        refresh(1, bid);
    }

    async function doCreate() {
        setFormError("");
        const res = await createAnnouncement(
            title,
            body,
            targetBatch || null,
            priority,
            expiresAt || null
        );
        if (!res.success) return setFormError(res.error);
        setCreateOpen(false);
        setTitle(""); setBody(""); setTargetBatch(""); setPriority("normal"); setExpiresAt("");
        setAlert({ kind: "success", msg: "Announcement published — students will see it in their bell icon." });
        await refresh(1);
    }

    async function doArchive() {
        if (!archiveTarget) return;
        const res = await archiveAnnouncement(archiveTarget.id);
        if (res.success) {
            setArchiveTarget(null);
            setAlert({ kind: "success", msg: "Announcement removed." });
            await refresh();
        }
    }

    const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "top" };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Announcements</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                        Push in-app notifications to students. High priority shows on their dashboard.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => { setFormError(""); setCreateOpen(true); }}>
                    + New Announcement
                </button>
            </div>

            {alert && <AlertBanner kind={alert.kind} message={alert.msg} onClose={() => setAlert(null)} />}

            <div style={{ marginBottom: 16, maxWidth: 320 }}>
                <FormField label="Filter by batch" htmlFor="ann-batch">
                    <select id="ann-batch" className="input-base" value={batchFilter} onChange={(e) => onFilterChange(e.target.value)}>
                        <option value="">All batches</option>
                        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </FormField>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
                {data.items.length === 0 ? (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                        No announcements yet — post a welcome message for your batch.
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                                <th style={td}>Title</th>
                                <th style={td}>Audience</th>
                                <th style={td}>Priority</th>
                                <th style={td}>Status</th>
                                <th style={td}>Posted</th>
                                <th style={{ ...td, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((a) => (
                                <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={td}>
                                        <div style={{ fontWeight: 500 }}>{a.title}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, maxWidth: 360 }}>{a.body.slice(0, 120)}{a.body.length > 120 ? "…" : ""}</div>
                                    </td>
                                    <td style={td}>{a.batch_name || "All batches"}</td>
                                    <td style={td}><Tag variant={a.priority === "high" ? "red" : "blue"}>{a.priority}</Tag></td>
                                    <td style={td}><Tag variant={STATUS_VARIANT[a.status]}>{a.status}</Tag></td>
                                    <td style={{ ...td, color: "var(--text-secondary)" }}>{formatDate(a.created_at)}</td>
                                    <td style={{ ...td, textAlign: "right" }}>
                                        <button className="btn btn-ghost" style={{ fontSize: 12, color: "var(--red)" }} onClick={() => setArchiveTarget(a)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Pagination page={data.page} total={data.total} onPage={(p) => refresh(p)} />

            <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Announcement">
                {formError && <AlertBanner kind="error" message={formError} />}
                <FormField label="Title" htmlFor="ann-title">
                    <input id="ann-title" className="input-base" value={title} onChange={(e) => setTitle(e.target.value)} />
                </FormField>
                <FormField label="Message" htmlFor="ann-body">
                    <textarea id="ann-body" className="input-base" rows={4} value={body} onChange={(e) => setBody(e.target.value)} style={{ resize: "vertical" }} />
                </FormField>
                <FormField label="Target batch" htmlFor="ann-target">
                    <select id="ann-target" className="input-base" value={targetBatch} onChange={(e) => setTargetBatch(e.target.value)}>
                        <option value="">All batches</option>
                        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </FormField>
                <FormField label="Priority" htmlFor="ann-pri">
                    <select id="ann-pri" className="input-base" value={priority} onChange={(e) => setPriority(e.target.value)}>
                        <option value="normal">Normal (bell only)</option>
                        <option value="high">High (bell + dashboard banner)</option>
                    </select>
                </FormField>
                <FormField label="Expires (optional)" htmlFor="ann-exp" hint="Leave blank to keep until you remove it.">
                    <input id="ann-exp" type="datetime-local" className="input-base" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </FormField>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                    <SubmitButton onClick={doCreate}>Publish</SubmitButton>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={!!archiveTarget}
                title="Remove announcement?"
                message="Students will no longer see this message."
                confirmLabel="Remove"
                onConfirm={doArchive}
                onCancel={() => setArchiveTarget(null)}
            />
        </div>
    );
}
