// Plain module (no "server-only") so the standalone restore script can import it.

// Tables included in the weekly JSON backup.
export const BACKUP_TABLES = [
    "batches",
    "chapters",
    "profiles",
    "tests",
    "test_versions",
    "questions",
    "test_attempts",
    "test_responses",
    "study_materials",
    "announcements",
] as const;

// FK-safe order for restore (parents before children).
export const RESTORE_ORDER: readonly string[] = [
    "batches",
    "chapters",
    "profiles",
    "study_materials",
    "tests",
    "test_versions",
    "questions",
    "test_attempts",
    "test_responses",
    "announcements",
];

export const BACKUP_DIR = "backups";
export const BACKUP_RETENTION_WEEKS = 8;

export interface BackupFile {
    generatedAt: string;
    version: number;
    tables: Record<string, unknown[]>;
}
