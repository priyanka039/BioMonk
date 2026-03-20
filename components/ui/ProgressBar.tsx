interface ProgressBarProps {
    value: number; // 0–100
    color?: "green" | "gold" | "red" | "blue";
    height?: number;
    className?: string;
}

export default function ProgressBar({
    value,
    color = "green",
    height = 6,
    className = "",
}: ProgressBarProps) {
    const colorVar = {
        green: "var(--green)",
        gold: "var(--gold)",
        red: "var(--red)",
        blue: "var(--blue)",
    }[color];

    const pct = Math.min(100, Math.max(0, value));

    return (
        <div
            className={`progress-bar ${className}`}
            style={{ height }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className="progress-bar-fill"
                style={{ width: `${pct}%`, height, background: colorVar }}
            />
        </div>
    );
}
