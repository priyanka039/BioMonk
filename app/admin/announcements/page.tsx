import AnnouncementsAdminClient from "./AnnouncementsAdminClient";
import { getAnnouncements } from "../actions/announcements";
import { getBatchesList } from "../actions/batches";

export const dynamic = "force-dynamic";

interface Props {
    searchParams: Promise<{ batch?: string }>;
}

export default async function AnnouncementsPage({ searchParams }: Props) {
    const { batch: batchId } = await searchParams;
    const [annRes, batchesRes] = await Promise.all([
        getAnnouncements(1, batchId),
        getBatchesList(),
    ]);
    const initial = annRes.success && annRes.data ? annRes.data : { items: [], total: 0, page: 1 };
    const batches = batchesRes.success && batchesRes.data ? batchesRes.data : [];
    return (
        <AnnouncementsAdminClient
            initial={initial}
            batches={batches}
            filterBatchId={batchId || ""}
        />
    );
}
