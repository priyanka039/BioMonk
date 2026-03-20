"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { PDFViewerProps } from "./PDFViewer";

// Use CDN worker — avoids bundler issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewerInner({ isOpen, onClose, signedUrl, title }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loadError, setLoadError] = useState(false);
    const [blobUrl, setBlobUrl] = useState<string>("");
    const [fetching, setFetching] = useState(false);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setCurrentPage(1);
        setLoadError(false);
    }

    function goTo(page: number) {
        setCurrentPage(Math.min(Math.max(1, page), numPages));
    }

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!isOpen || !signedUrl) return;
            setFetching(true);
            setLoadError(false);

            // Clean up previous blob URL
            setBlobUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return "";
            });

            try {
                const res = await fetch(signedUrl);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const ct = res.headers.get("content-type") || "";
                if (!ct.toLowerCase().includes("pdf")) {
                    // Often indicates an auth/permission HTML page got downloaded instead of PDF
                    const text = await res.text().catch(() => "");
                    throw new Error(`Not a PDF response (${ct || "unknown"}). ${text.slice(0, 120)}`);
                }
                const blob = await res.blob();
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                setBlobUrl(url);
            } catch {
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setFetching(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [isOpen, signedUrl]);

    useEffect(() => {
        if (!isOpen) {
            setBlobUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return "";
            });
            setNumPages(0);
            setCurrentPage(1);
            setLoadError(false);
            setFetching(false);
        }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                setBlobUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return "";
                });
                onClose();
            }}
            title={title}
            maxWidth={760}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* PDF render area */}
                <div
                    style={{
                        background: "#1a1a1a",
                        borderRadius: 8,
                        minHeight: 480,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    {loadError ? (
                        <div style={{ padding: 40, textAlign: "center" }}>
                            <p style={{ color: "var(--red)", fontSize: 14, marginBottom: 8 }}>
                                Could not load the PDF in browser.
                            </p>
                            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                                Please use the Download button below.
                            </p>
                        </div>
                    ) : fetching ? (
                        <div style={{ color: "var(--text-muted)", padding: 48, textAlign: "center" }}>
                            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" style={{ margin: "0 auto 12px", display: "block" }}>
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                            </svg>
                            Loading PDF...
                        </div>
                    ) : (
                        <Document
                            file={blobUrl || signedUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={() => setLoadError(true)}
                            loading={
                                <div style={{ color: "var(--text-muted)", padding: 48, textAlign: "center" }}>
                                    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" style={{ margin: "0 auto 12px", display: "block" }}>
                                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                                    </svg>
                                    Loading PDF...
                                </div>
                            }
                        >
                            <Page
                                pageNumber={currentPage}
                                width={680}
                                renderTextLayer={true}
                                renderAnnotationLayer={false}
                            />
                        </Document>
                    )}
                </div>

                {/* Navigation — only shown when loaded */}
                {numPages > 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        <button
                            onClick={() => goTo(1)}
                            disabled={currentPage === 1}
                            className="btn btn-ghost"
                            style={{ padding: "5px 10px", fontSize: 12 }}
                        >«</button>
                        <button
                            onClick={() => goTo(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="btn btn-ghost"
                            style={{ padding: "5px 12px", fontSize: 13 }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                            Prev
                        </button>

                        <span style={{ color: "var(--text-secondary)", fontSize: 13, minWidth: 100, textAlign: "center" }}>
                            Page {currentPage} of {numPages}
                        </span>

                        <button
                            onClick={() => goTo(currentPage + 1)}
                            disabled={currentPage === numPages}
                            className="btn btn-ghost"
                            style={{ padding: "5px 12px", fontSize: 13 }}
                        >
                            Next
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        <button
                            onClick={() => goTo(numPages)}
                            disabled={currentPage === numPages}
                            className="btn btn-ghost"
                            style={{ padding: "5px 10px", fontSize: 12 }}
                        >»</button>

                        {/* Jump to page */}
                        <input
                            type="number"
                            min={1}
                            max={numPages}
                            value={currentPage}
                            onChange={(e) => goTo(parseInt(e.target.value))}
                            className="input-base"
                            style={{ width: 60, padding: "5px 8px", textAlign: "center", fontSize: 13 }}
                            aria-label="Jump to page"
                        />
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <a
                        href={signedUrl}
                        download
                        className="btn btn-primary"
                        style={{ textDecoration: "none" }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Full PDF
                    </a>
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
}

