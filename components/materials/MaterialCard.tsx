"use client";

import { useState } from "react";
import { StudyMaterial, Chapter, MaterialType } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import PDFViewer from "./PDFViewer";
import Tag from "@/components/ui/Tag";

const TYPE_META: Record<MaterialType, { label: string; color: string; tagVariant: "green" | "gold" | "red" | "blue" }> = {
    notes: { label: "Lecture Notes", color: "var(--green)", tagVariant: "green" },
    mindmap: { label: "Mind Map", color: "var(--gold)", tagVariant: "gold" },
    pyq: { label: "PYQ Set", color: "var(--red)", tagVariant: "red" },
    formula_sheet: { label: "Formula Sheet", color: "var(--blue)", tagVariant: "blue" },
};

function FileIcon({ color }: { color: string }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    );
}

interface MaterialCardProps {
    material: StudyMaterial & { chapter?: Chapter };
}

export default function MaterialCard({ material }: MaterialCardProps) {
    const [pdfOpen, setPdfOpen] = useState(false);
    const [signedUrl, setSignedUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const meta = TYPE_META[material.type] || {
        label: material.type,
        color: "var(--text-secondary)",
        tagVariant: "muted" as const,
    };

    async function getUrl(): Promise<string> {
        const supabase = createClient();
        const { data, error } = await supabase.storage
            .from("study-material-bucket")
            .createSignedUrl(material.file_path, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;

        // Fallback: if DB only stores filename (or path is wrong), resolve by filename on server
        const filenameOnly = material.file_path.includes("/")
            ? material.file_path.split("/").pop() || material.file_path
            : material.file_path;

        const res = await fetch(
            `/api/storage/resolve-material?filename=${encodeURIComponent(filenameOnly)}&expiresIn=3600`
        );

        if (!res.ok) {
            const body = await res.json().catch(() => null);
            const msg =
                (body && (body.error as string)) ||
                `Object not found (path: "${material.file_path}")`;
            throw new Error(`Storage error: ${msg} (path: "${material.file_path}")`);
        }

        const body = (await res.json()) as { signedUrl?: string; resolvedPath?: string };
        if (!body?.signedUrl) {
            throw new Error(`Storage error: Could not generate signed URL (path: "${material.file_path}")`);
        }
        return body.signedUrl;
    }

    async function downloadViaBlob(url: string, filename: string) {
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Download failed (${res.status}). ${text.slice(0, 120)}`);
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.toLowerCase().includes("pdf")) {
            const text = await res.text().catch(() => "");
            throw new Error(`Expected a PDF but received "${ct || "unknown"}". ${text.slice(0, 120)}`);
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    }

    async function handlePreview() {
        setLoading(true);
        setActionError(null);
        try {
            const url = await getUrl();
            setSignedUrl(url);
            setPdfOpen(true);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Preview failed.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDownload() {
        setLoading(true);
        setActionError(null);
        try {
            const url = await getUrl();
            await downloadViaBlob(url, material.title + ".pdf");
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Download failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div
                className="card"
                style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9,
                            background: `${meta.color}15`,
                            border: `1px solid ${meta.color}25`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <FileIcon color={meta.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Tag variant={meta.tagVariant}>{meta.label}</Tag>
                        <p
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                marginTop: 6,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                            }}
                        >
                            {material.title}
                        </p>
                    </div>
                </div>

                {/* Chapter info */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {material.chapter && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {material.chapter.name}
                        </span>
                    )}
                    {material.chapter && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface-3)", padding: "1px 6px", borderRadius: 4 }}>
                            Class {material.chapter.class_level}
                        </span>
                    )}
                </div>

                {/* File meta */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 14 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {material.page_count} pages
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {material.file_size_kb > 1024
                                ? `${(material.file_size_kb / 1024).toFixed(1)} MB`
                                : `${material.file_size_kb} KB`}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={handlePreview}
                        disabled={loading}
                        className="btn btn-ghost"
                        style={{ flex: 1, fontSize: 13, padding: "8px" }}
                        aria-label={`Preview ${material.title}`}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        Preview
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: 13, padding: "8px" }}
                        aria-label={`Download ${material.title}`}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Download
                    </button>
                </div>

                {actionError ? (
                    <p style={{ marginTop: 10, color: "var(--red)", fontSize: 12.5, lineHeight: 1.45 }}>
                        {actionError}
                    </p>
                ) : null}
            </div>

            {pdfOpen && signedUrl && (
                <PDFViewer
                    isOpen={pdfOpen}
                    onClose={() => setPdfOpen(false)}
                    signedUrl={signedUrl}
                    title={material.title}
                    pageCount={material.page_count}
                />
            )}
        </>
    );
}
