import { describe, it, expect } from "vitest";
import { restoreFromBackup, type RestoreClient } from "@/lib/backup-restore";
import { RESTORE_ORDER, type BackupFile } from "@/lib/backup-tables";

function makeFakeClient(seed: Record<string, Record<string, unknown>[]> = {}) {
    const store: Record<string, Record<string, unknown>[]> = { ...seed };
    const client: RestoreClient = {
        from(table: string) {
            return {
                select: async () => ({ count: store[table]?.length ?? 0, error: null }),
                upsert: async (rows: Record<string, unknown>[]) => {
                    store[table] = [...(store[table] || []), ...rows];
                    return { error: null };
                },
            };
        },
    };
    return { client, store };
}

function sampleBackup(): BackupFile {
    return {
        generatedAt: new Date().toISOString(),
        version: 1,
        tables: {
            profiles: [{ id: "p1", full_name: "Asha" }, { id: "p2", full_name: "Ravi" }],
            tests: [{ id: "t1", title: "Chapter 1" }],
            questions: [{ id: "q1", test_id: "t1" }, { id: "q2", test_id: "t1" }, { id: "q3", test_id: "t1" }],
        },
    };
}

describe("restoreFromBackup", () => {
    it("upserts every backed-up row (roundtrip)", async () => {
        const backup = sampleBackup();
        const { client, store } = makeFakeClient();

        const result = await restoreFromBackup(client, backup, { dryRun: false });

        expect(result.dryRun).toBe(false);
        expect(store.profiles).toHaveLength(2);
        expect(store.tests).toHaveLength(1);
        expect(store.questions).toHaveLength(3);
        expect(result.totalRows).toBe(6);
        // Every table processed in FK-safe order.
        expect(result.tables.map((t) => t.table)).toEqual([...RESTORE_ORDER]);
    });

    it("writes nothing in dry-run mode", async () => {
        const backup = sampleBackup();
        const { client, store } = makeFakeClient();

        const result = await restoreFromBackup(client, backup, { dryRun: true });

        expect(result.dryRun).toBe(true);
        expect(store.profiles).toBeUndefined();
        expect(store.tests).toBeUndefined();
        expect(store.questions).toBeUndefined();
        expect(result.tables.every((t) => t.upserted === 0)).toBe(true);
    });

    it("throws if an upsert fails (so the operator sees the failure)", async () => {
        const backup = sampleBackup();
        const client: RestoreClient = {
            from() {
                return {
                    select: async () => ({ count: 0, error: null }),
                    upsert: async () => ({ error: { message: "constraint violation" } }),
                };
            },
        };
        await expect(restoreFromBackup(client, backup, { dryRun: false })).rejects.toThrow(/constraint violation/);
    });
});
