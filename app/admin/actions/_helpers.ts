import "server-only";

export { PAGE_SIZE, pageRange } from "@/lib/pagination";

export type ActionResult<T = undefined> =
    | { success: true; data?: T; warning?: string }
    | { success: false; error: string };

export function ok<T>(data?: T, warning?: string): ActionResult<T> {
    return { success: true, data, warning };
}

export function fail(error: string): ActionResult<never> {
    return { success: false, error };
}

// Wraps an action body so a thrown error (incl. NOT_AUTHENTICATED) becomes a
// clean { success:false } instead of an unhandled server exception.
export async function run<T>(
    fn: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
    try {
        return await fn();
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "NOT_AUTHENTICATED") {
            return fail("Your session expired. Please sign in again.");
        }
        return fail(msg || "Something went wrong.");
    }
}

// Turns a title/name into a safe storage slug (no traversal, no spaces).
export function slugify(input: string): string {
    return (input || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "misc";
}
