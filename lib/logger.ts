// Structured JSON logging. Console in dev; Vercel captures stdout/stderr in prod.
// Always pass durationMs for operations so we can spot slow uploads/extractions.

type LogContext = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, ctx?: LogContext) {
    const line = JSON.stringify({
        level,
        event,
        ts: new Date().toISOString(),
        ...ctx,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
}

export const log = {
    info: (event: string, ctx?: LogContext) => emit("info", event, ctx),
    warn: (event: string, ctx?: LogContext) => emit("warn", event, ctx),
    error: (event: string, ctx?: LogContext) => emit("error", event, ctx),
};
