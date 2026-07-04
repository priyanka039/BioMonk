// Client- and server-safe pagination helpers (no "server-only").

export const PAGE_SIZE = 25;

export function pageRange(page: number, size: number = PAGE_SIZE) {
    const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const from = (p - 1) * size;
    const to = from + size - 1;
    return { from, to, page: p };
}
