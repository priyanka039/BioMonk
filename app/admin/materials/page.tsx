import MaterialsAdminClient from "./MaterialsAdminClient";
import { getMaterials, getChapters } from "../actions/materials";
import { getBatchesList } from "../actions/batches";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
    const [mats, chapters, batches] = await Promise.all([
        getMaterials(1, ""),
        getChapters(),
        getBatchesList(),
    ]);
    const initial = mats.success && mats.data ? mats.data : { items: [], total: 0, page: 1 };
    const chapterList = chapters.success && chapters.data ? chapters.data : [];
    const batchList = batches.success && batches.data ? batches.data : [];
    return <MaterialsAdminClient initial={initial} chapters={chapterList} batches={batchList} />;
}
