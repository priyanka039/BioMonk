import MaterialsAdminClient from "./MaterialsAdminClient";
import { getMaterials, getChapters } from "../actions/materials";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
    const [mats, chapters] = await Promise.all([getMaterials(1, ""), getChapters()]);
    const initial = mats.success && mats.data ? mats.data : { items: [], total: 0, page: 1 };
    const chapterList = chapters.success && chapters.data ? chapters.data : [];
    return <MaterialsAdminClient initial={initial} chapters={chapterList} />;
}
