import { ScheduleEvent } from "@/lib/types";

interface ScheduleWidgetProps {
    events: ScheduleEvent[];
}

function TestIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
    );
}
function ClassIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
    );
}
function AssignIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
    );
}

export default function ScheduleWidget({ events }: ScheduleWidgetProps) {
    return (
        <div className="card" style={{ padding: 24, height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        This Week
                    </p>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: "var(--text-primary)" }}>
                        Upcoming Schedule
                    </h3>
                </div>
                <span
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 99,
                        background: "rgba(224,156,44,0.12)",
                        color: "var(--gold)",
                        border: "1px solid rgba(224,156,44,0.2)",
                    }}
                >
                    Coming Soon
                </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {events.map((ev) => {
                    const color = ev.type === "test" ? "var(--red)" : ev.type === "class" ? "var(--blue)" : "var(--gold)";
                    const bg = ev.type === "test" ? "rgba(224,82,82,0.1)" : ev.type === "class" ? "rgba(74,156,224,0.1)" : "rgba(224,156,44,0.1)";
                    const icon = ev.type === "test" ? <TestIcon /> : ev.type === "class" ? <ClassIcon /> : <AssignIcon />;
                    return (
                        <div
                            key={ev.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "10px 12px",
                                borderRadius: 8,
                                background: "var(--surface-2)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: bg,
                                    color,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {ev.title}
                                </p>
                                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    {ev.day} · {ev.time}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p style={{ marginTop: 14, fontSize: 11.5, color: "var(--text-muted)", textAlign: "center" }}>
                Live calendar integration coming soon
            </p>
        </div>
    );
}
