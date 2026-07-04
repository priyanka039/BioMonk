// Deterministic date formatting shared by admin (and other) UI.
//
// Why this exists: calling `new Date(x).toLocaleDateString()` with no locale
// uses the *ambient* locale, which differs between the server (often en-US)
// and the user's browser (e.g. en-GB/en-IN). That produces "3/17/2026" on the
// server and "17/3/2026" on the client → a React hydration mismatch.
//
// Pinning both the locale AND the timeZone makes the output identical wherever
// it runs. A month abbreviation ("17 Mar 2026") is also unambiguous.

const TIME_ZONE = "Asia/Kolkata";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
});

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
    if (value === null || value === undefined || value === "") return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. "17 Mar 2026". Returns "—" for missing/invalid input. */
export function formatDate(value: DateInput): string {
    const d = toDate(value);
    return d ? DATE_FMT.format(d) : "—";
}

/** e.g. "17 Mar 2026, 14:30". Returns "—" for missing/invalid input. */
export function formatDateTime(value: DateInput): string {
    const d = toDate(value);
    return d ? DATETIME_FMT.format(d) : "—";
}
