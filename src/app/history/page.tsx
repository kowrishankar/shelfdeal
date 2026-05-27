import { AppShell } from "@/components/AppShell";
import { HistoryClient } from "@/components/history/HistoryClient";

export const metadata = {
  title: "History | Bargain Goods",
};

export default function HistoryPage() {
  return (
    <AppShell title="Search history" subtitle="Your recent product lookups">
      <div className="mx-auto max-w-lg px-4 py-4">
        <HistoryClient />
      </div>
    </AppShell>
  );
}
