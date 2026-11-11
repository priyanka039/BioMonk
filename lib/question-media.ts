/** Shared helpers for detecting placeholder option/stem text and media needs. */

export const OPTION_PLACEHOLDER_RE =
    /Option text not extracted|likely in a (table|figure)|Refer to the original PDF/i;

export const STEM_PLACEHOLDER_RE =
    /Refer to the (figure|diagram|question text)|original PDF|original table/i;

/** Match-column / assertion tables should be one stem screenshot, not option slices. */
export const TABLE_LIKE_STEM_RE =
    /match\s+column|column[\s-]*i\b|column[\s-]*ii\b|select the correct option|assertion|reason|given below|following table|observe the/i;

/** Stems that clearly ask for figure options (safe for per-option embeds). */
export const FIGURE_OPTIONS_STEM_RE =
    /which of the following (figures?|diagrams?|images?|pictures?)|identify the (figure|diagram)|shown in (the )?(figure|diagram)/i;

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
    if (t.length < 12) return true;
    // Truncated mid-sentence (common when PDF text cuts at a figure).
    if (/\b(the|a|an|and|of|to|for|with|from|by|in|on|_____+)\s*$/i.test(t)) return true;
    if (/_{3,}/.test(t)) return true;
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

/** Prefer one full question screenshot instead of slicing options. */
export function shouldUseFullQuestionShot(q: {
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
}): boolean {
    const optPlaceholders = [q.option_a, q.option_b, q.option_c, q.option_d].filter(
        optionNeedsMedia
    ).length;
    if (optPlaceholders >= 2) return true;
    if (TABLE_LIKE_STEM_RE.test(q.question_text || "")) return true;
    if (stemNeedsMedia(q.question_text) && optPlaceholders >= 1) return true;
    return false;
}

/** Only attach per-option images when the stem clearly asks for figures and embeds exist. */
export function shouldAttachOptionImages(q: {
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
}): boolean {
    if (shouldUseFullQuestionShot(q) && !FIGURE_OPTIONS_STEM_RE.test(q.question_text || "")) {
        return false;
    }
    return FIGURE_OPTIONS_STEM_RE.test(q.question_text || "");
}

export function displayOptionText(
    text: string,
    hasImage: boolean,
    /** When the stem screenshot already shows the options/table, hide placeholders. */
    stemCoversOptions = false
): string | null {
    if (isPlaceholderOption(text) && (hasImage || stemCoversOptions)) return null;
    return text;
}

export function displayStemText(text: string, hasImage: boolean): string | null {
    if (hasImage && isPlaceholderStem(text)) return null;
    return text;
}
