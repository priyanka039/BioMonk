import StudentsAdminClient from "./StudentsAdminClient";
import { getStudents, getBatches } from "../actions/students";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
    const [students, batches] = await Promise.all([getStudents(1, ""), getBatches()]);
    const initial = students.success && students.data ? students.data : { items: [], total: 0, page: 1 };
    const batchList = batches.success && batches.data ? batches.data : [];
    return <StudentsAdminClient initial={initial} batches={batchList} />;
}
