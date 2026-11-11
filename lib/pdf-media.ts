/**
 * Auto-attach question/option images from PDF screenshots + embedded images.
 * Uses pdf-parse CanvasFactory (Node) and @napi-rs/canvas for crops.
 *
 * Strategy (conservative — avoids broken table slices into A/B/C/D):
 * 1. When text is missing / truncated / table-like → crop the FULL question band as stem image
 * 2. Per-option images ONLY when the stem clearly asks for figures AND embedded images exist
 * 3. Never blindly slice a 2×2 screenshot grid into options
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { ParsedQuestion } from "@/lib/parser";
import {
    mediaSlotsNeeded,
    shouldAttachOptionImages,
    shouldUseFullQuestionShot,
    type MediaSlot,
} from "@/lib/question-media";
import { STORAGE_BUCKET } from "@/lib/admin-supabase";
import { log } from "@/lib/logger";

export interface QuestionMediaPaths {
    question_image_path?: string | null;
    option_a_image_path?: string | null;
    option_b_image_path?: string | null;
    option_c_image_path?: string | null;
    option_d_image_path?: string | null;
}

export interface MediaAttachStats {
    withStemImage: number;
    withOptionImages: number;
    placeholderOptions: number;
    uploadedPaths: string[];
}

async function cropPng(
    png: Uint8Array,
    x: number,
    y: number,
    w: number,
    h: number
): Promise<Buffer> {
    const img = await loadImage(Buffer.from(png));
    const sx = Math.max(0, Math.floor(x));
    const sy = Math.max(0, Math.floor(y));
    const sw = Math.max(1, Math.min(Math.floor(w), img.width - sx));
    const sh = Math.max(1, Math.min(Math.floor(h), img.height - sy));
    const canvas = createCanvas(sw, sh);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toBuffer("image/png");
}

async function loadPdfParser(buffer: Buffer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workerMod = (await import("pdf-parse/worker")) as any;
    const CanvasFactory = workerMod?.CanvasFactory;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfMod = (await import("pdf-parse")) as any;
    if (typeof pdfMod?.PDFParse !== "function") {
        throw new Error("pdf-parse PDFParse unavailable");
    }
    const uint8 = Uint8Array.from(buffer);
    return new pdfMod.PDFParse({
        data: uint8,
        ...(CanvasFactory ? { CanvasFactory } : {}),
    });
}

async function uploadPng(
    supa: SupabaseClient,
    path: string,
    bytes: Buffer
): Promise<boolean> {
    const { error } = await supa.storage.from(STORAGE_BUCKET).upload(path, bytes, {
        contentType: "image/png",
        upsert: true,
    });
    if (error) {
        log.warn("pdf.media.upload_failed", { path, error: error.message });
        return false;
    }
    return true;
}

function slotPath(
    testId: string,
    version: number,
    orderIndex: number,
    slot: MediaSlot
): string {
    const name = slot === "stem" ? "stem.png" : `opt_${slot}.png`;
    return `tests/${testId}/v${version}/q${orderIndex}/${name}`;
}

function isLikelyDiagramEmbed(bytes: Uint8Array): boolean {
    // Skip tiny icons / bullets; keep real diagrams.
    return bytes.length >= 2500;
}

/**
 * For questions missing text, attach a full question-band screenshot as the stem image.
 * Option images only when figure-options + embedded images are available.
 */
export async function attachQuestionMedia(params: {
    pdfBuffer: Buffer;
    questions: ParsedQuestion[];
    testId: string;
    versionNumber: number;
    supa: SupabaseClient;
}): Promise<{ media: QuestionMediaPaths[]; stats: MediaAttachStats }> {
    const { pdfBuffer, questions, testId, versionNumber, supa } = params;
    const media: QuestionMediaPaths[] = questions.map(() => ({}));
    const stats: MediaAttachStats = {
        withStemImage: 0,
        withOptionImages: 0,
        placeholderOptions: 0,
        uploadedPaths: [],
    };

    for (const q of questions) {
        stats.placeholderOptions += mediaSlotsNeeded(q).filter((s) => s !== "stem").length;
    }

    const needsAny = questions.some((q) => mediaSlotsNeeded(q).length > 0);
    if (!needsAny || questions.length === 0) {
        return { media, stats };
    }

    let parser: { getScreenshot: Function; getImage: Function; destroy?: Function } | null =
        null;
    try {
        const loaded = await loadPdfParser(pdfBuffer);
        parser = loaded;

        const shots = await loaded.getScreenshot({
            scale: 1.35,
            imageBuffer: true,
            imageDataUrl: false,
        });
        const pages: Array<{
            pageNumber: number;
            data: Uint8Array;
            width: number;
            height: number;
        }> = (shots?.pages || [])
            .filter((p: { data?: Uint8Array }) => p?.data && p.data.length > 0)
            .map(
                (p: {
                    pageNumber: number;
                    data: Uint8Array;
                    width: number;
                    height: number;
                }) => ({
                    pageNumber: p.pageNumber,
                    data: p.data,
                    width: p.width || 1,
                    height: p.height || 1,
                })
            )
            .sort(
                (a: { pageNumber: number }, b: { pageNumber: number }) =>
                    a.pageNumber - b.pageNumber
            );

        const embeds: Uint8Array[] = [];
        try {
            const imgRes = await loaded.getImage({
                imageThreshold: 80,
                imageBuffer: true,
                imageDataUrl: false,
            });
            for (const page of imgRes?.pages || []) {
                for (const im of page.images || []) {
                    if (im?.data?.length && isLikelyDiagramEmbed(im.data)) {
                        embeds.push(im.data);
                    }
                }
            }
        } catch (e) {
            log.warn("pdf.media.getImage_failed", {
                error: e instanceof Error ? e.message : String(e),
            });
        }

        if (pages.length === 0) {
            log.warn("pdf.media.no_screenshots", { testId });
            return { media, stats };
        }

        const n = questions.length;
        const pageCount = pages.length;
        let embedIdx = 0;

        for (let pi = 0; pi < pageCount; pi++) {
            const page = pages[pi];
            const startQ = Math.floor((pi * n) / pageCount);
            const endQ = Math.floor(((pi + 1) * n) / pageCount);
            const count = Math.max(0, endQ - startQ);
            if (count === 0) continue;

            const bandH = page.height / count;
            const marginX = Math.floor(page.width * 0.03);
            const usableW = page.width - marginX * 2;
            const padY = Math.max(4, Math.floor(bandH * 0.02));

            for (let j = 0; j < count; j++) {
                const qi = startQ + j;
                const q = questions[qi];
                const slots = mediaSlotsNeeded(q);
                if (slots.length === 0) continue;

                const bandY = j * bandH;
                const paths = media[qi];
                const wantFull = shouldUseFullQuestionShot(q) || slots.includes("stem");

                // Always prefer a full question-band screenshot when media is needed.
                if (wantFull) {
                    try {
                        const stemBuf = await cropPng(
                            page.data,
                            marginX,
                            bandY + padY,
                            usableW,
                            Math.max(24, bandH - padY * 2)
                        );
                        const path = slotPath(testId, versionNumber, qi + 1, "stem");
                        if (await uploadPng(supa, path, stemBuf)) {
                            paths.question_image_path = path;
                            stats.uploadedPaths.push(path);
                            stats.withStemImage++;
                        }
                    } catch (e) {
                        log.warn("pdf.media.stem_crop_failed", {
                            qi,
                            error: e instanceof Error ? e.message : String(e),
                        });
                    }
                }

                // Per-option images: embeds only, and only for clear figure-option stems.
                const optSlots = (["a", "b", "c", "d"] as const).filter((s) =>
                    slots.includes(s)
                );
                if (
                    optSlots.length === 0 ||
                    !shouldAttachOptionImages(q) ||
                    embedIdx >= embeds.length
                ) {
                    continue;
                }

                let anyOpt = false;
                for (const slot of optSlots) {
                    if (embedIdx >= embeds.length) break;
                    try {
                        const bytes = Buffer.from(embeds[embedIdx]);
                        embedIdx++;
                        const path = slotPath(testId, versionNumber, qi + 1, slot);
                        if (await uploadPng(supa, path, bytes)) {
                            const key =
                                `option_${slot}_image_path` as keyof QuestionMediaPaths;
                            (paths as Record<string, string>)[key] = path;
                            stats.uploadedPaths.push(path);
                            anyOpt = true;
                        }
                    } catch (e) {
                        log.warn("pdf.media.option_embed_failed", {
                            qi,
                            slot,
                            error: e instanceof Error ? e.message : String(e),
                        });
                    }
                }
                if (anyOpt) stats.withOptionImages++;
            }
        }
    } catch (e) {
        log.error("pdf.media.attach_failed", {
            testId,
            error: e instanceof Error ? e.message : String(e),
        });
    } finally {
        try {
            await parser?.destroy?.();
        } catch {
            /* ignore */
        }
    }

    return { media, stats };
}

export async function removeStoragePaths(
    supa: SupabaseClient,
    paths: string[]
): Promise<void> {
    if (!paths.length) return;
    for (let i = 0; i < paths.length; i += 50) {
        const chunk = paths.slice(i, i + 50);
        await supa.storage.from(STORAGE_BUCKET).remove(chunk).then(
            () => {},
            () => {}
        );
    }
}
