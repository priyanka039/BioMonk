import ChaptersAdminClient from "./ChaptersAdminClient";
import { getBatchesList } from "../actions/batches";
import { getChaptersForBatch } from "../actions/chapters";

export const dynamic = "force-dynamic";

interface Props {
    searchParams: Promise<{ batch?: string }>;
}

export default async function ChaptersPage({ searchParams }: Props) {
    const { batch: batchId } = await searchParams;
    const batchesRes = await getBatchesList();
    const batches = batchesRes.success && batchesRes.data ? batchesRes.data : [];
    const activeBatchId = batchId || batches[0]?.id || "";
    const chaptersRes = activeBatchId ? await getChaptersForBatch(activeBatchId) : { success: true as const, data: [] };
    const chapters = chaptersRes.success && chaptersRes.data ? chaptersRes.data : [];
    return (
        <ChaptersAdminClient
            batches={batches}
            initialBatchId={activeBatchId}
            initialChapters={chapters}
        />
    );
}
