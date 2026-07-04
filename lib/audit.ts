import "server-only";
import { getAdminClient } from "./admin-supabase";
import { getAdminSession } from "./admin-auth";
import { log } from "./logger";

export type AuditAction =
    | "create"
    | "update"
    | "archive"
    | "restore"
    | "activate"
    | "deactivate"
    | "extract"
    | "login"
    | "backup";

export interface AuditMeta {
    before?: unknown;
    after?: unknown;
    durationMs?: number;
    [key: string]: unknown;
}

// Writes an audit row. Never throws — auditing must not break the action.
export async function writeAudit(
    action: AuditAction,
    tableName: string,
    recordId: string | null,
    metadata: AuditMeta = {}
): Promise<void> {
    try {
        const session = await getAdminSession();
        const supa = getAdminClient();
        await supa.from("audit_logs").insert({
            action,
            table_name: tableName,
            record_id: recordId,
            admin_email: session?.email ?? "unknown",
            metadata,
        });
    } catch (e) {
        log.error("audit.write.failed", {
            action,
            tableName,
            recordId,
            error: e instanceof Error ? e.message : String(e),
        });
    }
}
