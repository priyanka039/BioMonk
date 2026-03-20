"use client";

import dynamic from "next/dynamic";

// IMPORTANT: react-pdf/pdf.js touches browser-only APIs (DOMMatrix).
// This wrapper keeps it out of the server bundle.
const PDFViewerInner = dynamic(() => import("./PDFViewerInner"), { ssr: false });

export interface PDFViewerProps {
    isOpen: boolean;
    onClose: () => void;
    signedUrl: string;
    title: string;
    pageCount: number;
}

export default function PDFViewer(props: PDFViewerProps) {
    return <PDFViewerInner {...props} />;
}
