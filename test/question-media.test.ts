import { describe, it, expect } from "vitest";
import {
    isPlaceholderOption,
    isPlaceholderStem,
    mediaSlotsNeeded,
    displayOptionText,
    displayStemText,
    shouldUseFullQuestionShot,
    shouldAttachOptionImages,
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

    it("flags weak, truncated, or figure stems", () => {
        expect(isPlaceholderStem("")).toBe(true);
        expect(isPlaceholderStem("See fig")).toBe(true);
        expect(isPlaceholderStem("Refer to the figure above")).toBe(true);
        expect(
            isPlaceholderStem(
                "As the anthers mature and dehydrate, the _____ separate dissociate from each other and"
            )
        ).toBe(true);
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

    it("prefers full question shot for match-column / multi-placeholder options", () => {
        const matchQ = {
            question_text: "Match Column-I and select the correct option",
            option_a: "Option text not extracted (likely in a table)",
            option_b: "Option text not extracted (likely in a table)",
            option_c: "Option text not extracted (likely in a table)",
            option_d: "Option text not extracted (likely in a table)",
        };
        expect(shouldUseFullQuestionShot(matchQ)).toBe(true);
        expect(shouldAttachOptionImages(matchQ)).toBe(false);
    });

    it("allows option embeds only for clear figure-option stems", () => {
        const figQ = {
            question_text: "Which of the following figures shows a T.S. of anther?",
            option_a: "",
            option_b: "",
            option_c: "",
            option_d: "",
        };
        expect(shouldAttachOptionImages(figQ)).toBe(true);
    });

    it("hides placeholder copy when an image or stem shot covers options", () => {
        expect(
            displayOptionText("Option text not extracted (likely in a table)", true)
        ).toBeNull();
        expect(
            displayOptionText(
                "Option text not extracted (likely in a table)",
                false,
                true
            )
        ).toBeNull();
        expect(displayOptionText("Mitochondria", true)).toBe("Mitochondria");
        expect(displayStemText("Refer to the original PDF", true)).toBeNull();
        expect(displayStemText("What is ATP?", true)).toBe("What is ATP?");
    });
});
