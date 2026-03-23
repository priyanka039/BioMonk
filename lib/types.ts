export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Profile {
    id: string;
    full_name: string;
    batch_id: string | null;
    avatar_url: string | null;
    created_at: string;
}

export interface Batch {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    created_at?: string;
}

export interface Chapter {
    id: string;
    name: string;
    description: string;
    class_level: "XI" | "XII";
    order_index: number;
    batch_id: string;
    is_locked: boolean;
}

export type MaterialType = "notes" | "mindmap" | "pyq" | "formula_sheet";

export interface StudyMaterial {
    id: string;
    chapter_id: string;
    title: string;
    type: MaterialType;
    file_path: string;
    file_size_kb: number;
    page_count: number;
    created_at: string;
    // Joined
    chapter?: Chapter;
}

export type TestType = "chapter_test" | "full_mock" | "dpp";

export interface Test {
    id: string;
    chapter_id: string | null;
    title: string;
    type: TestType;
    duration_minutes: number;
    total_marks: number;
    marks_correct: number;
    marks_wrong: number;
    is_active: boolean;
    scheduled_at: string | null;
    batch_id: string;
    subject?: "biology" | "chemistry" | "physics" | null;
    original_file_path?: string | null;
    // Joined
    chapter?: Chapter;
    question_count?: number;
}

export interface Question {
    id: string;
    test_id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: "A" | "B" | "C" | "D";
    explanation: string | null;
    order_index: number;
}

export interface TestAttempt {
    id: string;
    student_id: string;
    test_id: string;
    started_at: string;
    submitted_at: string | null;
    score: number | null;
    max_score?: number | null;
    is_completed: boolean;
}

export interface TestResponse {
    id: string;
    attempt_id: string;
    question_id: string;
    selected_option: "A" | "B" | "C" | "D" | null;
    is_marked_for_review: boolean;
    time_spent_seconds: number;
}

// ─── Compound / View Types ────────────────────────────────────────────────────

export interface TestAttemptWithTest extends TestAttempt {
    test: Test;
}

export interface TestResponseWithQuestion extends TestResponse {
    question: Question;
}

export interface ChapterProgress {
    chapter: Chapter;
    materials_count: number;
    tests_count: number;
    completed_tests: number;
}

// ─── Schedule Config ─────────────────────────────────────────────────────────

export interface ScheduleEvent {
    id: string;
    title: string;
    day: string;
    time: string;
    type: "test" | "class" | "assignment";
}
