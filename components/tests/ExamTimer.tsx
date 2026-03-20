"use client";

import { useEffect, useState, useRef } from "react";

interface ExamTimerProps {
    totalSeconds: number;
    onExpire: () => void;
}

export default function ExamTimer({ totalSeconds, onExpire }: ExamTimerProps) {
    const [remaining, setRemaining] = useState(totalSeconds);
    const expiredRef = useRef(false);

    useEffect(() => {
        if (remaining <= 0) {
            if (!expiredRef.current) {
                expiredRef.current = true;
                onExpire();
            }
            return;
        }
        const id = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(id);
                    if (!expiredRef.current) {
                        expiredRef.current = true;
                        onExpire();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, []); // only run once on mount

    const hours = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;

    const timerClass =
        remaining < 300
            ? "timer-red"
            : remaining < 600
                ? "timer-gold"
                : "timer-normal";

    const pad = (n: number) => String(n).padStart(2, "0");

    return (
        <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Time Remaining
            </p>
            <p
                id="exam-timer"
                className={`stat-number ${timerClass}`}
                style={{ fontSize: 32 }}
            >
                {hours > 0 ? `${pad(hours)}:` : ""}{pad(mins)}:{pad(secs)}
            </p>
            {remaining < 300 && (
                <p style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>
                    Less than 5 minutes left!
                </p>
            )}
        </div>
    );
}
