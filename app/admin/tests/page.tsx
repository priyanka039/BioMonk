import TestsAdminClient from "./TestsAdminClient";
import { getTests, getTestFormData } from "../actions/tests";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
    const [tests, formData] = await Promise.all([getTests(1, ""), getTestFormData()]);
    const initial = tests.success && tests.data ? tests.data : { items: [], total: 0, page: 1 };
    const form = formData.success && formData.data ? formData.data : { batches: [], chapters: [] };
    return <TestsAdminClient initial={initial} batches={form.batches} chapters={form.chapters} />;
}
