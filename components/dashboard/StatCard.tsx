interface StatCardProps {
    label: string;
    value: string | number;
    subtext?: string;
    change?: string;
    changePositive?: boolean;
    icon: React.ReactNode;
    accentColor?: string;
}

export default function StatCard({
    label,
    value,
    subtext,
    change,
    changePositive,
    icon,
    accentColor = "var(--green)",
}: StatCardProps) {
    return (
        <div
            className="card"
            style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}
        >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: `${accentColor}18`,
                        border: `1px solid ${accentColor}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: accentColor,
                    }}
                >
                    {icon}
                </div>

                {change && (
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: changePositive ? "var(--green)" : "var(--red)",
                            background: changePositive ? "rgba(43,191,120,0.1)" : "rgba(224,82,82,0.1)",
                            padding: "2px 8px",
                            borderRadius: 99,
                        }}
                    >
                        {changePositive ? "+" : ""}{change}
                    </span>
                )}
            </div>

            <div>
                <p
                    className="stat-number"
                    style={{ fontSize: 30, color: "var(--text-primary)", lineHeight: 1 }}
                >
                    {value}
                </p>
                {subtext && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {subtext}
                    </p>
                )}
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, fontWeight: 500 }}>
                    {label}
                </p>
            </div>
        </div>
    );
}
