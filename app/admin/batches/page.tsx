import BatchesAdminClient from "./BatchesAdminClient";
import { getBatches } from "../actions/batches";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
    const res = await getBatches(1);
    const initial = res.success && res.data ? res.data : { items: [], total: 0, page: 1 };
    return <BatchesAdminClient initial={initial} />;
}
