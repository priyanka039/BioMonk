"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { isDerivedErrorBookEntry, isMissingTableError } from "@/lib/error-book";
import type { ErrorBookActionResult } from "@/lib/error-book-types";

async function getAuthenticatedStudentId() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Not authenticated");
    }

    return { supabase, studentId: user.id };
}

function actionError(message: string): ErrorBookActionResult {
    if (isMissingTableError(message)) {
        return {
            ok: false,
            error: "Error Book storage is not set up yet. Run migration 004_error_book.sql in Supabase.",
        };
    }
    return { ok: false, error: message };
}

function guardPersistableEntry(entryId: string): ErrorBookActionResult | null {
    if (isDerivedErrorBookEntry({ id: entryId })) {
        return {
            ok: false,
            error: "This mistake is read-only until the Error Book database table is created.",
        };
    }
    return null;
}

export async function markErrorBookEntryResolved(entryId: string): Promise<ErrorBookActionResult> {
    const blocked = guardPersistableEntry(entryId);
    if (blocked) return blocked;

    const { supabase, studentId } = await getAuthenticatedStudentId();

    const { error } = await supabase
        .from("error_book_entries")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", entryId)
        .eq("student_id", studentId);

    if (error) return actionError(error.message);

    revalidatePath("/error-book");
    return { ok: true };
}

export async function markErrorBookEntryUnresolved(entryId: string): Promise<ErrorBookActionResult> {
    const blocked = guardPersistableEntry(entryId);
    if (blocked) return blocked;

    const { supabase, studentId } = await getAuthenticatedStudentId();

    const { error } = await supabase
        .from("error_book_entries")
        .update({ resolved_at: null })
        .eq("id", entryId)
        .eq("student_id", studentId);

    if (error) return actionError(error.message);

    revalidatePath("/error-book");
    return { ok: true };
}

export async function updateErrorBookEntryNotes(
    entryId: string,
    notes: string
): Promise<ErrorBookActionResult> {
    const blocked = guardPersistableEntry(entryId);
    if (blocked) return blocked;

    const { supabase, studentId } = await getAuthenticatedStudentId();

    const { error } = await supabase
        .from("error_book_entries")
        .update({ notes: notes.trim() || null })
        .eq("id", entryId)
        .eq("student_id", studentId);

    if (error) return actionError(error.message);

    revalidatePath("/error-book");
    return { ok: true };
}

export async function removeErrorBookEntry(entryId: string): Promise<ErrorBookActionResult> {
    const blocked = guardPersistableEntry(entryId);
    if (blocked) return blocked;

    const { supabase, studentId } = await getAuthenticatedStudentId();

    const { error } = await supabase
        .from("error_book_entries")
        .delete()
        .eq("id", entryId)
        .eq("student_id", studentId);

    if (error) return actionError(error.message);

    revalidatePath("/error-book");
    return { ok: true };
}
