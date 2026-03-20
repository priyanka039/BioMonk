"use client";

import { createClient } from "@/lib/supabase";
import type { Question, Test, TestAttempt, TestResponse } from "@/lib/types";
import ResultAnalysis from "@/components/tests/ResultAnalysis";

interface ResultClientProps {
  test: Test;
  attempt: TestAttempt;
  questions: Question[];
  responses: TestResponse[];
  batchRank: number;
}

export default function ResultClient({
  test,
  attempt,
  questions,
  responses,
  batchRank,
}: ResultClientProps) {
  return (
    <ResultAnalysis
      test={test}
      attempt={attempt}
      questions={questions}
      responses={responses}
      batchRank={batchRank}
    />
  );
}

