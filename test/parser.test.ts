import { describe, it, expect } from "vitest";
import { parseText } from "@/lib/parser";

// Build N "Question / Option x4 / Answer" blocks (answer is 1-based → letter).
function qoaBlocks(n: number, answer = 2): string {
    const blocks: string[] = [];
    for (let i = 1; i <= n; i++) {
        blocks.push(
            [
                `Question Sample question number ${i}?`,
                `Option choice one ${i}`,
                `Option choice two ${i}`,
                `Option choice three ${i}`,
                `Option choice four ${i}`,
                `Answer ${answer}`,
            ].join("\n")
        );
    }
    return blocks.join("\n");
}

describe("parseText — DPP answer-key grid", () => {
    it("matches questions to a trailing answer key", () => {
        const text = [
            "1. What is the powerhouse of the cell?",
            "1) Nucleus",
            "2) Mitochondria",
            "3) Ribosome",
            "4) Golgi",
            "2. Water is made of?",
            "1) Hydrogen and Oxygen",
            "2) Carbon",
            "3) Nitrogen",
            "4) Helium",
            "Answer Key",
            "1 2",
            "2 1",
        ].join("\n");

        const r = parseText(text);
        expect(r.questions.length).toBe(2);
        expect(r.questions[0].correct_option).toBe("B"); // answer 2
        expect(r.questions[1].correct_option).toBe("A"); // answer 1
        expect(r.unmatched.length).toBe(0);
    });
});

describe("parseText — table format (Question/Option/Answer, >= 5 blocks)", () => {
    it("extracts all blocks", () => {
        const r = parseText(qoaBlocks(6, 3));
        expect(r.format).toBe("table_format");
        expect(r.questions.length).toBe(6);
        expect(r.questions.every((q) => q.correct_option === "C")).toBe(true); // answer 3
    });
});

describe("parseText — inline Question/Option/Answer (< 5 blocks)", () => {
    it("extracts inline questions and answers", () => {
        const r = parseText(qoaBlocks(3, 2));
        expect(r.format).toBe("inline_answer");
        expect(r.questions.length).toBe(3);
        expect(r.questions.every((q) => q.correct_option === "B")).toBe(true);
    });
});

describe("parseText — empty / no questions", () => {
    it("returns zero questions and never throws", () => {
        const r = parseText("");
        expect(r.questions.length).toBe(0);
        const r2 = parseText("Just some prose with no questions at all.");
        expect(r2.questions.length).toBe(0);
    });
});
