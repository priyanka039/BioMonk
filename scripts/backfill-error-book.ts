/**
 * Backfill error_book_entries from completed test attempts.
 * Run after applying migration 004_error_book.sql if historical data is missing.
 *
 * Usage:
 *   npx tsx scripts/backfill-error-book.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
    const { data: attempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("id, student_id, test_id, submitted_at, started_at")
        .eq("is_completed", true);

    if (attemptsError) {
        throw new Error(attemptsError.message);
    }

    let inserted = 0;
    let skipped = 0;

    for (const attempt of attempts ?? []) {
        const { data: responses, error: responsesError } = await supabase
            .from("test_responses")
            .select("question_id, selected_option, question:questions(correct_option)")
            .eq("attempt_id", attempt.id)
            .not("selected_option", "is", null);

        if (responsesError) {
            throw new Error(responsesError.message);
        }

        for (const response of responses ?? []) {
            const question = response.question as { correct_option: string } | null;
            if (!question || response.selected_option === question.correct_option) {
                continue;
            }

            const { error } = await supabase.from("error_book_entries").upsert(
                {
                    student_id: attempt.student_id,
                    question_id: response.question_id,
                    attempt_id: attempt.id,
                    test_id: attempt.test_id,
                    selected_option: response.selected_option,
                    correct_option: question.correct_option,
                    created_at: attempt.submitted_at ?? attempt.started_at,
                },
                { onConflict: "student_id,question_id", ignoreDuplicates: true }
            );

            if (error) {
                if (error.code === "23505") {
                    skipped++;
                } else {
                    throw new Error(error.message);
                }
            } else {
                inserted++;
            }
        }
    }

    console.log(`Backfill complete. Inserted: ${inserted}, skipped duplicates: ${skipped}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
