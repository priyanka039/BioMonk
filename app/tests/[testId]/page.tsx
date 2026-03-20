import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TestTakingClient from "./TestTakingClient";
import type { Metadata } from "next";

interface Props {
    params: Promise<{ testId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { testId } = await params;
    return {
        title: `Test — BioMonk`,
        description: "Take your NEET Biology test on BioMonk.",
    };
}

export default async function TestTakingPage({ params }: Props) {
    const { testId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Fetch test details
    const { data: test } = await supabase
        .from("tests")
        .select("*, chapter:chapters(*)")
        .eq("id", testId)
        .single();

    if (!test || !test.is_active) notFound();

    // Fetch questions
    const { data: questions } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", testId)
        .order("order_index");

    if (!questions || questions.length === 0) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
                <div style={{ textAlign: "center", padding: 40 }}>
                    <h2 style={{ fontFamily: "'Fraunces', serif", color: "var(--text-primary)", marginBottom: 12 }}>
                        No Questions Yet
                    </h2>
                    <p style={{ color: "var(--text-muted)" }}>
                        This test has no questions loaded yet. Please check back later.
                    </p>
                </div>
            </div>
        );
    }

    // Check for existing attempt
    const { data: existingAttempt } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("student_id", user.id)
        .eq("test_id", testId)
        .maybeSingle();

    // If already completed, redirect to result
    if (existingAttempt?.is_completed) {
        redirect(`/tests/${testId}/result`);
    }

    // Fetch existing responses if resuming
    let existingResponses: any[] = [];
    if (existingAttempt) {
        const { data } = await supabase
            .from("test_responses")
            .select("*")
            .eq("attempt_id", existingAttempt.id);
        existingResponses = data || [];
    }

    // Calculate remaining time if resuming
    let remainingSeconds = test.duration_minutes * 60;
    if (existingAttempt) {
        const elapsed = Math.floor(
            (Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000
        );
        remainingSeconds = Math.max(0, test.duration_minutes * 60 - elapsed);
    }

    return (
        <TestTakingClient
            test={test}
            questions={questions}
            userId={user.id}
            existingAttempt={existingAttempt}
            existingResponses={existingResponses}
            remainingSeconds={remainingSeconds}
        />
    );
}
