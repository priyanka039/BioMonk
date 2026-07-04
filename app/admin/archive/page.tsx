import ArchiveClient from "./ArchiveClient";
import { getArchived } from "../actions/archive";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
    const res = await getArchived();
    const initial = res.success && res.data ? res.data : { materials: [], tests: [] };
    return <ArchiveClient initial={initial} />;
}
