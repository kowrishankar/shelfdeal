import { AppShell } from "@/components/AppShell";
import { InsightsClient } from "@/components/insights/InsightsClient";

export const metadata = {
  title: "Insights",
};

export default function InsightsPage() {
  return (
    <AppShell
      title="Market insights"
      subtitle="Trends, deals & tracked prices"
    >
      <div className="mx-auto max-w-lg px-4 py-4">
        <InsightsClient />
      </div>
    </AppShell>
  );
}
