import ActivityClient from "./ActivityClient";
import { getActivity } from "../actions/activity";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
    const res = await getActivity(1);
    const initial = res.success && res.data ? res.data : { items: [], total: 0, page: 1 };
    return <ActivityClient initial={initial} />;
}
