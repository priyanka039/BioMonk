/** Shared helpers for detecting placeholder option/stem text and media needs. */

export const OPTION_PLACEHOLDER_RE =
    /Option text not extracted|likely in a (table|figure)|Refer to the original PDF/i;

export const STEM_PLACEHOLDER_RE =
    /Refer to the (figure|diagram|question text)|original PDF|original table/i;

export type MediaSlot = "stem" | "a" | "b" | "c" | "d";

export function isPlaceholderOption(text: string | null | undefined): boolean {
    const t = (text || "").trim();
    if (!t) return true;
    return OPTION_PLACEHOLDER_RE.test(t);
}

export function isPlaceholderStem(text: string | null | undefined): boolean {
    const t = (text || "").trim();
    if (!t) return true;
    if (STEM_PLACEHOLDER_RE.test(t)) return true;
    // Truncated stems often end mid-sentence with connector words.
    if (t.length < 12) return true;
    return false;
}

export function optionNeedsMedia(text: string | null | undefined): boolean {
    return isPlaceholderOption(text);
}

export function stemNeedsMedia(text: string | null | undefined): boolean {
    return isPlaceholderStem(text);
}

export function mediaSlotsNeeded(q: {
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
}): MediaSlot[] {
    const slots: MediaSlot[] = [];
    if (stemNeedsMedia(q.question_text)) slots.push("stem");
    if (optionNeedsMedia(q.option_a)) slots.push("a");
    if (optionNeedsMedia(q.option_b)) slots.push("b");
    if (optionNeedsMedia(q.option_c)) slots.push("c");
    if (optionNeedsMedia(q.option_d)) slots.push("d");
    return slots;
}

export function displayOptionText(text: string, hasImage: boolean): string | null {
    if (hasImage && isPlaceholderOption(text)) return null;
    return text;
}

export function displayStemText(text: string, hasImage: boolean): string | null {
    if (hasImage && isPlaceholderStem(text)) return null;
    return text;
}
