"use client";

import { useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import { formatDate } from "@/lib/format";
import {
    getArchived,
    restoreArchived,
    type ArchivedMaterial,
    type ArchivedTest,
} from "../actions/archive";

type Data = { materials: ArchivedMaterial[]; tests: ArchivedTest[] };

export default function ArchiveClient({ initial }: { initial: Data }) {
    const [data, setData] = useState<Data>(initial);
    const [alert, setAlert] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

    async function refresh() {
        const res = await getArchived();
        if (res.success && res.data) setData(res.data);
    }

    async function restore(kind: "material" | "test", id: string, title: string) {
        const res = await restoreArchived(kind, id);
        if (res.success) {
            setAlert({ kind: "success", msg: `Restored "${title}".` });
            await refresh();
        } else {
            setAlert({ kind: "error", msg: res.error });
        }
    }

    const empty = data.materials.length === 0 && data.tests.length === 0;

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Archive</h2>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                    Archived items are hidden from students. Restore anything with one click.
                </p>
            </div>

            {alert && <AlertBanner kind={alert.kind} message={alert.msg} onClose={() => setAlert(null)} />}

            {empty ? (
                <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                    Nothing archived. Deleted materials and tests will appear here so you can bring them back.
                </div>
            ) : (
                <>
                    {data.materials.length > 0 && (
                        <section style={{ marginBottom: 28 }}>
                            <h3 style={{ fontSize: 15, marginBottom: 10, color: "var(--text-secondary)" }}>
                                Materials ({data.materials.length})
                            </h3>
                            <div className="card" style={{ overflow: "hidden" }}>
                                {data.materials.map((m) => (
                                    <div key={m.id} style={row}>
                                        <div>
                                            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{m.title}</div>
                                            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                                                {m.chapter?.name || "—"} · archived {formatDate(m.deleted_at)}
                                            </div>
                                        </div>
                                        <SubmitButton variant="secondary" onClick={() => restore("material", m.id, m.title)}>
                                            Restore
                                        </SubmitButton>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {data.tests.length > 0 && (
                        <section>
                            <h3 style={{ fontSize: 15, marginBottom: 10, color: "var(--text-secondary)" }}>
                                Tests ({data.tests.length})
                            </h3>
                            <div className="card" style={{ overflow: "hidden" }}>
                                {data.tests.map((t) => (
                                    <div key={t.id} style={row}>
                                        <div>
                                            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{t.title}</div>
                                            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                                                archived {formatDate(t.deleted_at)}
                                            </div>
                                        </div>
                                        <SubmitButton variant="secondary" onClick={() => restore("test", t.id, t.title)}>
                                            Restore
                                        </SubmitButton>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 16px",
    borderTop: "1px solid var(--border)",
};
