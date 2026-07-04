"use client";

import Modal from "@/components/ui/Modal";
import SubmitButton from "./SubmitButton";

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    confirmVariant = "danger",
    onConfirm,
    onCancel,
}: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: "primary" | "danger";
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}) {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth={440}>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 22, lineHeight: 1.6 }}>
                {message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button className="btn btn-ghost" onClick={onCancel}>
                    Cancel
                </button>
                <SubmitButton variant={confirmVariant} onClick={onConfirm}>
                    {confirmLabel}
                </SubmitButton>
            </div>
        </Modal>
    );
}
