import { describe, it, expect } from "vitest";
import {
    isPlaceholderOption,
    isPlaceholderStem,
    mediaSlotsNeeded,
    displayOptionText,
    displayStemText,
} from "@/lib/question-media";

describe("question-media placeholders", () => {
    it("flags empty and table-placeholder options", () => {
        expect(isPlaceholderOption("")).toBe(true);
        expect(isPlaceholderOption("   ")).toBe(true);
        expect(
            isPlaceholderOption("Option text not extracted (likely in a table)")
        ).toBe(true);
        expect(isPlaceholderOption("Mitochondria")).toBe(false);
    });

    it("flags weak or figure stems", () => {
        expect(isPlaceholderStem("")).toBe(true);
        expect(isPlaceholderStem("See fig")).toBe(true);
        expect(isPlaceholderStem("Refer to the figure above")).toBe(true);
        expect(
            isPlaceholderStem("Which of the following correctly describes meiosis I?")
        ).toBe(false);
    });

    it("lists needs_media slots for a sparse question", () => {
        const slots = mediaSlotsNeeded({
            question_text: "Refer to the diagram",
            option_a: "Option text not extracted (likely in a table)",
            option_b: "Nucleus",
            option_c: "",
            option_d: "Ribosome",
        });
        expect(slots).toEqual(["stem", "a", "c"]);
    });

    it("hides placeholder copy when an image is present", () => {
        expect(
            displayOptionText("Option text not extracted (likely in a table)", true)
        ).toBeNull();
        expect(displayOptionText("Mitochondria", true)).toBe("Mitochondria");
        expect(displayStemText("Refer to the original PDF", true)).toBeNull();
        expect(displayStemText("What is ATP?", true)).toBe("What is ATP?");
    });
});
