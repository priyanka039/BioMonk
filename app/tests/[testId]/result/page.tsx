import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ResultClient from "./ResultClient";
import type { Metadata } from "next";

interface Props {
    params: Promise<{ testId: string }>;
}

export const metadata: Metadata = {
    title: "Test Result — BioMonk",
};

export default async function TestResultPage({ params }: Props) {
    const { testId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Fetch test
    const { data: test } = await supabase
        .from("tests")
        .select("*, chapter:chapters(*)")
        .eq("id", testId)
        .single();

    if (!test) notFound();

    // Fetch completed attempt
    const { data: attempt } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("student_id", user.id)
        .eq("test_id", testId)
        .eq("is_completed", true)
        .single();

    if (!attempt) redirect(`/tests/${testId}`);

    // Fetch questions
    const { data: questions } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", testId)
        .order("order_index");

    // Fetch responses
    const { data: responses } = await supabase
        .from("test_responses")
        .select("*")
        .eq("attempt_id", attempt.id);

    // Count batch attempts with higher score (for rank)
    const { count: betterCount } = await supabase
        .from("test_attempts")
        .select("*", { count: "exact", head: true })
        .eq("test_id", testId)
        .eq("is_completed", true)
        .gt("score", attempt.score ?? -999);

    const rank = (betterCount ?? 0) + 1;

    return (
        <ResultClient
            test={test}
            attempt={attempt}
            questions={questions || []}
            responses={responses || []}
            batchRank={rank}
        />
    );
}
