import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { Metadata } from "next";
import PrintToolbar from "./PrintToolbar";

export const metadata: Metadata = {
  title: "Download Result — BioMonk",
};

interface Props {
  params: Promise<{ testId: string }>;
}

export default async function TestResultPrintPage({ params }: Props) {
  const { testId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: test } = await supabase
    .from("tests")
    .select("*, chapter:chapters(*)")
    .eq("id", testId)
    .single();
  if (!test) notFound();

  const { data: attempt } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("student_id", user.id)
    .eq("test_id", testId)
    .eq("is_completed", true)
    .single();
  if (!attempt) redirect(`/tests/${testId}`);

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("test_id", testId)
    .order("order_index");

  const { data: responses } = await supabase
    .from("test_responses")
    .select("*")
    .eq("attempt_id", attempt.id);

  const responseMap: Record<string, any> = {};
  for (const r of responses || []) responseMap[r.question_id] = r;

  const score = attempt.score ?? 0;
  // Max marks for a test = number of questions * (+4 per correct)
  const totalMarks = (questions || []).length * (test.marks_correct ?? 4);

  return (
    <div style={{ background: "#fff", color: "#111", minHeight: "100vh" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { margin: 16mm; }
            @media print {
              .no-print { display: none !important; }
              a { color: inherit; text-decoration: none; }
            }
          `,
        }}
      />

      <PrintToolbar testId={testId} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 56px" }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
            {test.title}
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, color: "#4b5563" }}>
            <span>
              Score: <b style={{ color: "#111" }}>{score}</b> / {totalMarks}
            </span>
            <span style={{ margin: "0 10px" }}>•</span>
            <span>
              Submitted:{" "}
              {attempt.submitted_at
                ? new Date(attempt.submitted_at).toLocaleString("en-IN")
                : "-"}
            </span>
            {test.chapter?.name ? (
              <>
                <span style={{ margin: "0 10px" }}>•</span>
                <span>Chapter: {test.chapter.name}</span>
              </>
            ) : null}
          </div>
        </div>

        <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "16px 0 22px" }} />

        {(questions || []).map((q: any, idx: number) => {
          const r = responseMap[q.id];
          const selected: string | null = r?.selected_option ?? null;
          const correct: string = q.correct_option;

          function optText(letter: "A" | "B" | "C" | "D") {
            return (
              (letter === "A" ? q.option_a : letter === "B" ? q.option_b : letter === "C" ? q.option_c : q.option_d) ??
              ""
            );
          }

          return (
            <div
              key={q.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                marginBottom: 14,
                pageBreakInside: "avoid",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 800 }}>Q{idx + 1}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Your answer:{" "}
                  <b style={{ color: selected ? "#111" : "#6b7280" }}>
                    {selected ?? "—"}
                  </b>
                  {"  "} | Correct: <b style={{ color: "#059669" }}>{correct}</b>
                </div>
              </div>

              <div
                style={{ fontSize: 14.5, lineHeight: 1.65, marginBottom: 12 }}
                dangerouslySetInnerHTML={{
                  __html: String(q.question_text || "").replace(/\n/g, "<br/>"),
                }}
              />

              <div style={{ display: "grid", gap: 8 }}>
                {(["A", "B", "C", "D"] as const).map((opt) => {
                  const isCorrect = opt === correct;
                  const isSelected = opt === selected;
                  const bg = isCorrect ? "#ecfdf5" : isSelected ? "#eff6ff" : "#fff";
                  const border = isCorrect ? "#10b981" : isSelected ? "#3b82f6" : "#e5e7eb";
                  const color = isCorrect ? "#065f46" : isSelected ? "#1e40af" : "#111";

                  return (
                    <div
                      key={opt}
                      style={{
                        border: `1px solid ${border}`,
                        background: bg,
                        borderRadius: 10,
                        padding: "10px 12px",
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          border: `1px solid ${border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          color,
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {opt}
                      </div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.55, color }}>{optText(opt)}</div>
                    </div>
                  );
                })}
              </div>

              {q.explanation ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <div style={{ fontSize: 11, letterSpacing: "0.06em", fontWeight: 900, color: "#166534" }}>
                    EXPLANATION
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6, color: "#14532d" }}>
                    {q.explanation}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

