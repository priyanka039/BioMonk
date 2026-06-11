const STORAGE_KEY = "biomonk-error-book-local";

export interface LocalErrorBookState {
    resolvedQuestionIds: string[];
    notesByQuestionId: Record<string, string>;
    removedQuestionIds: string[];
}

function readState(): LocalErrorBookState {
    if (typeof window === "undefined") {
        return { resolvedQuestionIds: [], notesByQuestionId: {}, removedQuestionIds: [] };
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { resolvedQuestionIds: [], notesByQuestionId: {}, removedQuestionIds: [] };
        }
        const parsed = JSON.parse(raw) as Partial<LocalErrorBookState>;
        return {
            resolvedQuestionIds: parsed.resolvedQuestionIds ?? [],
            notesByQuestionId: parsed.notesByQuestionId ?? {},
            removedQuestionIds: parsed.removedQuestionIds ?? [],
        };
    } catch {
        return { resolvedQuestionIds: [], notesByQuestionId: {}, removedQuestionIds: [] };
    }
}

function writeState(state: LocalErrorBookState) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getLocalErrorBookState(): LocalErrorBookState {
    return readState();
}

export function isLocallyResolved(questionId: string): boolean {
    return readState().resolvedQuestionIds.includes(questionId);
}

export function getLocalNotes(questionId: string): string | null {
    return readState().notesByQuestionId[questionId] ?? null;
}

export function isLocallyRemoved(questionId: string): boolean {
    return readState().removedQuestionIds.includes(questionId);
}

export function setLocalResolved(questionId: string, resolved: boolean) {
    const state = readState();
    const ids = new Set(state.resolvedQuestionIds);
    if (resolved) ids.add(questionId);
    else ids.delete(questionId);
    writeState({ ...state, resolvedQuestionIds: [...ids] });
}

export function setLocalNotes(questionId: string, notes: string) {
    const state = readState();
    const notesByQuestionId = { ...state.notesByQuestionId };
    const trimmed = notes.trim();
    if (trimmed) notesByQuestionId[questionId] = trimmed;
    else delete notesByQuestionId[questionId];
    writeState({ ...state, notesByQuestionId });
}

export function setLocalRemoved(questionId: string) {
    const state = readState();
    const ids = new Set(state.removedQuestionIds);
    ids.add(questionId);
    writeState({ ...state, removedQuestionIds: [...ids] });
}
