"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/admin-supabase";
import { assertAdmin } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { log } from "@/lib/logger";
import { ok, fail, run, pageRange, slugify, type ActionResult } from "./_helpers";

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const VALID_TYPES = ["notes", "mindmap", "pyq", "formula_sheet"];

export interface MaterialRow {
    id: string;
    title: string;
    type: string;
    file_path: string;
    original_filename: string | null;
    file_size_kb: number;
    page_count: number;
    created_at: string;
    chapter?: { name: string } | null;
}

export async function getChapters() {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { data, error } = await supa
            .from("chapters")
            .select("id, name, class_level")
            .order("order_index");
        if (error) return fail(error.message);
        return ok(data || []);
    });
}

export async function getMaterials(page = 1, search = "") {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { from, to, page: p } = pageRange(page);

        let query = supa
            .from("study_materials")
            .select("*, chapter:chapters(name)", { count: "exact" })
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .range(from, to);

        if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);

        const { data, error, count } = await query;
        if (error) return fail(error.message);
        return ok({
            items: (data || []) as unknown as MaterialRow[],
            total: count || 0,
            page: p,
        });
    });
}

export type UploadResult =
    | { success: true; warning?: string }
    | { success: false; error: string; duplicate?: boolean };

export async function uploadStudyMaterial(
    formData: FormData,
    allowDuplicate = false
): Promise<UploadResult> {
    const t0 = Date.now();
    try {
        const session = await assertAdmin();
        const file = formData.get("file") as File | null;
        const title = String(formData.get("title") || "").trim();
        const type = String(formData.get("type") || "").trim();
        const chapterId = String(formData.get("chapter_id") || "").trim();

        if (!file || !title || !type || !chapterId) {
            return { success: false, error: "All fields are required." };
        }
        if (!VALID_TYPES.includes(type)) {
            return { success: false, error: "Invalid material type." };
        }
        if (file.size === 0) return { success: false, error: "The file is empty." };
        if (file.size > MAX_SIZE) {
            return { success: false, error: "File is larger than 50 MB." };
        }
        if (file.type && file.type !== "application/pdf") {
            return { success: false, error: "Only PDF files are allowed." };
        }
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            return { success: false, error: "Only .pdf files are allowed." };
        }

        const bytes = Buffer.from(await file.arrayBuffer());
        // Magic bytes: a real PDF starts with "%PDF".
        if (
            bytes.length < 4 ||
            bytes[0] !== 0x25 ||
            bytes[1] !== 0x50 ||
            bytes[2] !== 0x44 ||
            bytes[3] !== 0x46
        ) {
            return { success: false, error: "That file is not a valid PDF." };
        }

        const supa = getAdminClient();
        const hash = crypto.createHash("sha256").update(bytes).digest("hex");

        // Duplicate detection — warn, don't hard-block.
        const { data: dup } = await supa
            .from("study_materials")
            .select("id, title")
            .eq("file_hash", hash)
            .is("deleted_at", null)
            .maybeSingle();
        if (dup && !allowDuplicate) {
            return {
                success: false,
                duplicate: true,
                error: `This exact PDF is already uploaded as "${dup.title}". Upload it again anyway?`,
            };
        }

        // Resolve chapter name for a tidy storage path.
        const { data: chapter } = await supa
            .from("chapters")
            .select("name")
            .eq("id", chapterId)
            .maybeSingle();
        if (!chapter) return { success: false, error: "Selected chapter no longer exists." };

        const filePath = `${slugify(chapter.name)}/${crypto.randomUUID()}.pdf`;

        // 1) Upload to storage.
        const { error: upErr } = await supa.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
        if (upErr) {
            log.error("material.upload.storage_failed", { error: upErr.message });
            return { success: false, error: `Upload failed: ${upErr.message}` };
        }

        // 2) Insert DB row — rollback the storage file if this fails.
        const { data: inserted, error: dbErr } = await supa
            .from("study_materials")
            .insert({
                chapter_id: chapterId,
                title,
                type,
                file_path: filePath,
                original_filename: file.name,
                file_hash: hash,
                file_size_kb: Math.round(file.size / 1024),
                page_count: 0,
                created_by: session.email,
            })
            .select("id")
            .single();

        if (dbErr) {
            await supa.storage.from(STORAGE_BUCKET).remove([filePath]); // rollback
            log.error("material.upload.db_failed_rolledback", { error: dbErr.message });
            return { success: false, error: `Could not save material: ${dbErr.message}` };
        }

        await writeAudit("create", "study_materials", inserted.id, {
            title,
            type,
            original_filename: file.name,
            durationMs: Date.now() - t0,
        });
        revalidatePath("/admin/materials");
        log.info("material.uploaded", { id: inserted.id, durationMs: Date.now() - t0 });

        return dup
            ? { success: true, warning: "Uploaded (a duplicate copy of an existing PDF)." }
            : { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "NOT_AUTHENTICATED") {
            return { success: false, error: "Your session expired. Please sign in again." };
        }
        log.error("material.upload.exception", { error: msg });
        return { success: false, error: "Unexpected error during upload." };
    }
}

export async function archiveMaterial(id: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const t0 = Date.now();
        const supa = getAdminClient();
        const { data: before } = await supa
            .from("study_materials")
            .select("id, title, type")
            .eq("id", id)
            .maybeSingle();
        const { error } = await supa
            .from("study_materials")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id)
            .is("deleted_at", null);
        if (error) return fail(error.message);
        await writeAudit("archive", "study_materials", id, {
            before,
            durationMs: Date.now() - t0,
        });
        revalidatePath("/admin/materials");
        revalidatePath("/admin/archive");
        return ok();
    });
}

export async function restoreMaterial(id: string): Promise<ActionResult> {
    return run(async () => {
        await assertAdmin();
        const supa = getAdminClient();
        const { error } = await supa
            .from("study_materials")
            .update({ deleted_at: null })
            .eq("id", id);
        if (error) return fail(error.message);
        await writeAudit("restore", "study_materials", id, {});
        revalidatePath("/admin/materials");
        revalidatePath("/admin/archive");
        return ok();
    });
}
