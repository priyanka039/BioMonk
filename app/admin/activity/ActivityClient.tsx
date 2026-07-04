"use client";

import { useState } from "react";
import Tag from "@/components/ui/Tag";
import Pagination from "@/components/admin/Pagination";
import { formatDate } from "@/lib/format";
import { getActivity, type ActivityRow } from "../actions/activity";

type Page = { items: ActivityRow[]; total: number; page: number };

const ACTION_VARIANT: Record<string, "green" | "gold" | "red" | "blue" | "muted"> = {
    create: "green",
    update: "blue",
    activate: "green",
    deactivate: "gold",
    archive: "red",
    restore: "gold",
    extract: "blue",
    login: "muted",
    backup: "muted",
};

const TABLE_LABEL: Record<string, string> = {
    study_materials: "material",
    tests: "test",
    profiles: "student",
    admin_users: "admin",
    test_versions: "test version",
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return formatDate(iso);
}

function describe(row: ActivityRow): string {
    const meta = row.metadata || {};
    const subject =
        (meta.title as string) ||
        (meta.full_name as string) ||
        (meta.email as string) ||
        TABLE_LABEL[row.table_name] ||
        row.table_name;
    const verbs: Record<string, string> = {
        create: "Created",
        update: "Updated",
        archive: "Archived",
        restore: "Restored",
        activate: "Activated",
        deactivate: "Deactivated",
        extract: "Extracted questions for",
        login: "Signed in",
        backup: "Ran backup",
    };
    const verb = verbs[row.action] || row.action;
    if (row.action === "login") return "Signed in to admin";
    if (row.action === "backup") return "Weekly backup completed";
    return `${verb} ${TABLE_LABEL[row.table_name] || row.table_name}: ${subject}`;
}

export default function ActivityClient({ initial }: { initial: Page }) {
    const [data, setData] = useState<Page>(initial);

    async function refresh(page: number) {
        const res = await getActivity(page);
        if (res.success && res.data) setData(res.data);
    }

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Activity</h2>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                    Everything that happened in the admin panel, newest first.
                </p>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
                {data.items.length === 0 ? (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                        No activity recorded yet.
                    </div>
                ) : (
                    <ul style={{ listStyle: "none" }}>
                        {data.items.map((row) => (
                            <li
                                key={row.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: "12px 16px",
                                    borderTop: "1px solid var(--border)",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                    <Tag variant={ACTION_VARIANT[row.action] || "muted"}>{row.action}</Tag>
                                    <span style={{ fontSize: 13.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {describe(row)}
                                    </span>
                                </div>
                                <span suppressHydrationWarning style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                    {timeAgo(row.created_at)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Pagination page={data.page} total={data.total} onPage={refresh} />
        </div>
    );
}
