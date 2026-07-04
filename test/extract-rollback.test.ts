import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Shared, hoisted test state + a programmable fake Supabase client ──
const h = vi.hoisted(() => {
    const state = {
        versionDeleted: false,
        fileRemoved: false,
        lockCleared: 0,
        versionInserted: false,
        questionsInsertError: null as { message: string } | null,
        parseQuestions: [] as unknown[],
        parseReport: {
            format: "table_format",
            extracted: 0,
            failed: [] as { num: number; reason: string }[],
            unmatched: [] as number[],
            durationMs: 1,
            rawOutput: "",
        },
    };

    function makeClient() {
        const storage = {
            from() {
                return {
                    upload: async () => ({ error: null }),
                    remove: async () => {
                        state.fileRemoved = true;
                        return { error: null };
                    },
                };
            },
        };

        function from(table: string) {
            let op: "select" | "insert" | "update" | "delete" = "select";
            let payload: Record<string, unknown> | null = null;

            function resolve(): { data: unknown; error: unknown } {
                if (table === "questions" && op === "insert") {
                    return { data: null, error: state.questionsInsertError };
                }
                if (table === "tests" && op === "select") {
                    return { data: { id: "t1", extracting_at: null, marks_correct: 4, subject: null }, error: null };
                }
                if (table === "tests" && op === "update") {
                    if (payload && payload.extracting_at === null) state.lockCleared++;
                    return { data: null, error: null };
                }
                if (table === "test_versions" && op === "select") {
                    return { data: null, error: null }; // no prior version → next = 1
                }
                if (table === "test_versions" && op === "insert") {
                    state.versionInserted = true;
                    return { data: { id: "v1" }, error: null };
                }
                return { data: null, error: null };
            }

            const qb: Record<string, unknown> = {
                select: () => qb,
                insert: (rows: Record<string, unknown>) => { op = "insert"; payload = rows; return qb; },
                update: (p: Record<string, unknown>) => { op = "update"; payload = p; return qb; },
                delete: () => { op = "delete"; if (table === "test_versions") state.versionDeleted = true; return qb; },
                eq: () => qb,
                in: () => qb,
                is: () => qb,
                not: () => qb,
                order: () => qb,
                limit: () => qb,
                maybeSingle: () => Promise.resolve(resolve()),
                single: () => Promise.resolve(resolve()),
                then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
                    Promise.resolve(resolve()).then(onFulfilled, onRejected),
            };
            return qb;
        }

        return { from, storage };
    }

    return { state, makeClient };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({
    assertAdmin: vi.fn(async () => ({ adminId: "a1", email: "coach@biomonk.com", iat: 0 })),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/admin-supabase", () => ({
    getAdminClient: () => h.makeClient(),
    STORAGE_BUCKET: "study-material-bucket",
}));
vi.mock("@/lib/parser", () => ({
    parsePdf: vi.fn(async () => ({ questions: h.state.parseQuestions, report: h.state.parseReport })),
}));

import { extractTestQuestions } from "@/app/admin/actions/tests";

function pdfFormData(): FormData {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
    const file = new File([bytes], "questions.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.append("file", file);
    return fd;
}

const oneQuestion = {
    question_number: 1,
    question_text: "Q1",
    option_a: "a",
    option_b: "b",
    option_c: "c",
    option_d: "d",
    correct_option: "A",
};

describe("extractTestQuestions — atomicity", () => {
    beforeEach(() => {
        h.state.versionDeleted = false;
        h.state.fileRemoved = false;
        h.state.lockCleared = 0;
        h.state.versionInserted = false;
        h.state.questionsInsertError = null;
        h.state.parseQuestions = [];
    });

    it("rolls back the version + uploaded file when question insert fails", async () => {
        h.state.parseQuestions = [oneQuestion];
        h.state.questionsInsertError = { message: "boom" };

        const res = await extractTestQuestions("t1", pdfFormData());

        expect(res.success).toBe(false);
        expect(h.state.versionInserted).toBe(true); // version was created…
        expect(h.state.versionDeleted).toBe(true); // …then deleted on failure (cascade wipes questions)
        expect(h.state.fileRemoved).toBe(true); // orphan file cleaned up
        expect(h.state.lockCleared).toBeGreaterThanOrEqual(1); // lock released
    });

    it("on zero extracted questions: no version, file removed, no partial data", async () => {
        h.state.parseQuestions = []; // parser found nothing

        const res = await extractTestQuestions("t1", pdfFormData());

        expect(res.success).toBe(false);
        expect(h.state.versionInserted).toBe(false);
        expect(h.state.fileRemoved).toBe(true);
        expect(h.state.lockCleared).toBeGreaterThanOrEqual(1);
    });
});
