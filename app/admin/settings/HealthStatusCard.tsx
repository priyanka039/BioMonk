"use client";

import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";

export default function HealthStatusCard() {
    const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
    const [detail, setDetail] = useState("");

    useEffect(() => {
        fetch("/api/health")
            .then((r) => r.json())
            .then((data) => {
                if (data.status === "ok" && data.db && data.storage) {
                    setStatus("ok");
                    setDetail("Database and storage are reachable.");
                } else {
                    setStatus("error");
                    setDetail("Database or storage is not responding.");
                }
            })
            .catch(() => {
                setStatus("error");
                setDetail("Could not reach the health endpoint.");
            });
    }, []);

    return (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>System status</h3>
                {status === "loading" && <Tag variant="muted">Checking…</Tag>}
                {status === "ok" && <Tag variant="green">Healthy</Tag>}
                {status === "error" && <Tag variant="red">Issue</Tag>}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {status === "loading" ? "Pinging /api/health…" : detail}
            </p>
        </div>
    );
}
