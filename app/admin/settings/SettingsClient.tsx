"use client";

import { useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import SubmitButton from "@/components/admin/SubmitButton";
import FormField from "@/components/admin/FormField";
import { changeAdminPassword } from "../actions/settings";

export default function SettingsClient() {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [alert, setAlert] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

    async function save() {
        setAlert(null);
        const res = await changeAdminPassword(current, next, confirm);
        if (res.success) {
            setCurrent(""); setNext(""); setConfirm("");
            setAlert({ kind: "success", msg: "Password updated. Use it next time you sign in." });
        } else {
            setAlert({ kind: "error", msg: res.error });
        }
    }

    return (
        <div style={{ maxWidth: 480 }}>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>Settings</h2>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                    Change your admin password. No SQL, no redeploy.
                </p>
            </div>

            {alert && <AlertBanner kind={alert.kind} message={alert.msg} onClose={() => setAlert(null)} />}

            <div className="card" style={{ padding: 24 }}>
                <FormField label="Current password" htmlFor="cur">
                    <input id="cur" type="password" className="input-base" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
                </FormField>
                <FormField label="New password" htmlFor="new" hint="At least 8 characters.">
                    <input id="new" type="password" className="input-base" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
                </FormField>
                <FormField label="Confirm new password" htmlFor="conf">
                    <input id="conf" type="password" className="input-base" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                </FormField>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <SubmitButton onClick={save}>Update Password</SubmitButton>
                </div>
            </div>
        </div>
    );
}
