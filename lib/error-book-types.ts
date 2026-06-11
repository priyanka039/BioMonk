import type { Question, Test } from "@/lib/types";

export interface ErrorBookEntry {
    id: string;
    student_id: string;
    question_id: string;
    attempt_id: string;
    test_id: string;
    selected_option: "A" | "B" | "C" | "D";
    correct_option: "A" | "B" | "C" | "D";
    notes: string | null;
    resolved_at: string | null;
    created_at: string;
}

export interface ErrorBookEntryWithRelations extends ErrorBookEntry {
    question: Question;
    test: Pick<Test, "id" | "title" | "type" | "subject">;
    /** True when loaded from test_responses because error_book_entries is unavailable */
    is_derived?: boolean;
}

export type ErrorBookFilter = "all" | "unresolved" | "resolved";

export type ErrorBookActionResult =
    | { ok: true }
    | { ok: false; error: string };
