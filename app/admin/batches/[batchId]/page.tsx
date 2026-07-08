import { notFound } from "next/navigation";
import BatchDashboardClient from "./BatchDashboardClient";
import { getBatchDashboard } from "../../actions/batches";

export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ batchId: string }>;
}

export default async function BatchDashboardPage({ params }: Props) {
    const { batchId } = await params;
    const res = await getBatchDashboard(batchId);
    if (!res.success || !res.data) notFound();
    return <BatchDashboardClient initial={res.data} />;
}
