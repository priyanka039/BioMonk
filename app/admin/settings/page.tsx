import SettingsClient from "./SettingsClient";
import HealthStatusCard from "./HealthStatusCard";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
    return (
        <>
            <SettingsClient />
            <HealthStatusCard />
        </>
    );
}
