import type { SupabaseClient } from "@supabase/supabase-js";
import type { Question } from "@/lib/types";
import type { ErrorBookEntryWithRelations } from "@/lib/error-book-types";

export function isMissingTableError(message: string) {
    return (
        message.includes("error_book_entries") ||
        message.includes("does not exist") ||
        message.includes("schema cache")
    );
}

export function isDerivedErrorBookEntry(entry: { id: string; is_derived?: boolean }) {
    return entry.is_derived === true || entry.id.startsWith("derived-");
}

export async function isErrorBookTableReady(supabase: SupabaseClient): Promise<boolean> {
    const { error } = await supabase.from("error_book_entries").select("id").limit(1);
    if (!error) return true;
    return !isMissingTableError(error.message);
}

type ResponseLike = Record<string, { selected_option: string | null }>;

export async function syncErrorBookFromAttempt(
    supabase: SupabaseClient,
    studentId: string,
    attemptId: string,
    testId: string,
    questions: Question[],
    responses: ResponseLike
) {
    const wrongEntries = questions
        .filter((q) => {
            const selected = responses[q.id]?.selected_option;
            return selected && selected !== q.correct_option;
        })
        .map((q) => ({
            student_id: studentId,
            question_id: q.id,
            attempt_id: attemptId,
            test_id: testId,
            selected_option: responses[q.id].selected_option as "A" | "B" | "C" | "D",
            correct_option: q.correct_option,
            resolved_at: null,
        }));

    if (wrongEntries.length === 0) return;

    const { error } = await supabase
        .from("error_book_entries")
        .upsert(wrongEntries, { onConflict: "student_id,question_id" });

    if (error && !isMissingTableError(error.message)) {
        console.error("Error book sync failed:", error.message);
    }
}

export async function backfillStudentErrorBook(
    supabase: SupabaseClient,
    studentId: string
): Promise<boolean> {
    const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("id, test_id, submitted_at, started_at")
        .eq("student_id", studentId)
        .eq("is_completed", true);

    if (attemptsError) {
        if (isMissingTableError(attemptsError.message)) return false;
        throw new Error(attemptsError.message);
    }

    if (!attempts?.length) return true;

    for (const attempt of attempts) {
        const { data: responses, error: responsesError } = await supabase
            .from("test_responses")
            .select("question_id, selected_option, question:questions(correct_option)")
            .eq("attempt_id", attempt.id)
            .not("selected_option", "is", null);

        if (responsesError) {
            throw new Error(responsesError.message);
        }

        const rows = (responses ?? [])
            .filter((r) => {
                const question = r.question as { correct_option: string } | null;
                return question && r.selected_option !== question.correct_option;
            })
            .map((r) => {
                const question = r.question as { correct_option: string };
                return {
                    student_id: studentId,
                    question_id: r.question_id,
                    attempt_id: attempt.id,
                    test_id: attempt.test_id,
                    selected_option: r.selected_option as "A" | "B" | "C" | "D",
                    correct_option: question.correct_option as "A" | "B" | "C" | "D",
                    created_at: attempt.submitted_at ?? attempt.started_at,
                };
            });

        if (rows.length === 0) continue;

        const { error } = await supabase
            .from("error_book_entries")
            .upsert(rows, { onConflict: "student_id,question_id", ignoreDuplicates: true });

        if (error) {
            if (isMissingTableError(error.message)) return false;
            throw new Error(error.message);
        }
    }

    return true;
}

async function fetchErrorBookEntriesFromResponses(
    supabase: SupabaseClient,
    studentId: string,
    filter: "all" | "unresolved" | "resolved"
): Promise<ErrorBookEntryWithRelations[]> {
    if (filter === "resolved") return [];

    const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("id, test_id, submitted_at, started_at")
        .eq("student_id", studentId)
        .eq("is_completed", true)
        .order("submitted_at", { ascending: false });

    if (attemptsError) throw new Error(attemptsError.message);
    if (!attempts?.length) return [];

    const seen = new Set<string>();
    const entries: ErrorBookEntryWithRelations[] = [];

    for (const attempt of attempts) {
        const { data: responses, error: responsesError } = await supabase
            .from("test_responses")
            .select(`
                question_id,
                selected_option,
                question:questions(*),
                attempt:attempt_id(id)
            `)
            .eq("attempt_id", attempt.id)
            .not("selected_option", "is", null);

        if (responsesError) throw new Error(responsesError.message);

        const { data: test } = await supabase
            .from("tests")
            .select("id, title, type, subject")
            .eq("id", attempt.test_id)
            .single();

        for (const response of responses ?? []) {
            const question = response.question as Question | null;
            if (!question || response.selected_option === question.correct_option) continue;
            if (seen.has(question.id)) continue;
            seen.add(question.id);

            entries.push({
                id: `derived-${attempt.id}-${question.id}`,
                student_id: studentId,
                question_id: question.id,
                attempt_id: attempt.id,
                test_id: attempt.test_id,
                selected_option: response.selected_option as "A" | "B" | "C" | "D",
                correct_option: question.correct_option,
                notes: null,
                resolved_at: null,
                created_at: attempt.submitted_at ?? attempt.started_at,
                is_derived: true,
                question,
                test: test ?? {
                    id: attempt.test_id,
                    title: "Unknown test",
                    type: "chapter_test",
                    subject: null,
                },
            });
        }
    }

    return entries;
}

export async function fetchErrorBookEntries(
    supabase: SupabaseClient,
    studentId: string,
    filter: "all" | "unresolved" | "resolved" = "all"
): Promise<ErrorBookEntryWithRelations[]> {
    let query = supabase
        .from("error_book_entries")
        .select(`
            *,
            question:questions(*),
            test:tests(id, title, type, subject)
        `)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

    if (filter === "unresolved") {
        query = query.is("resolved_at", null);
    } else if (filter === "resolved") {
        query = query.not("resolved_at", "is", null);
    }

    const { data, error } = await query;

    if (error) {
        if (isMissingTableError(error.message)) {
            return fetchErrorBookEntriesFromResponses(supabase, studentId, filter);
        }
        throw new Error(error.message);
    }

    const entries = (data ?? []) as ErrorBookEntryWithRelations[];

    if (entries.length === 0 && filter === "all") {
        const tableReady = await backfillStudentErrorBook(supabase, studentId);
        if (tableReady) {
            const { data: refetched, error: refetchError } = await supabase
                .from("error_book_entries")
                .select(`
                    *,
                    question:questions(*),
                    test:tests(id, title, type, subject)
                `)
                .eq("student_id", studentId)
                .order("created_at", { ascending: false });

            if (!refetchError && refetched?.length) {
                return refetched as ErrorBookEntryWithRelations[];
            }
        }

        return fetchErrorBookEntriesFromResponses(supabase, studentId, filter);
    }

    return entries;
}

export function summarizeErrorBook(entries: ErrorBookEntryWithRelations[]) {
    const unresolved = entries.filter((e) => !e.resolved_at).length;
    const resolved = entries.filter((e) => e.resolved_at).length;
    const byTest: Record<string, { title: string; count: number }> = {};

    for (const entry of entries) {
        const title = entry.test?.title ?? "Unknown test";
        if (!byTest[entry.test_id]) {
            byTest[entry.test_id] = { title, count: 0 };
        }
        byTest[entry.test_id].count++;
    }

    return {
        total: entries.length,
        unresolved,
        resolved,
        byTest: Object.values(byTest).sort((a, b) => b.count - a.count),
    };
}
