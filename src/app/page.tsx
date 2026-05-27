import { HomeClient } from "@/components/HomeClient";
import { AppShell } from "@/components/AppShell";
import { ShelfDealLogo } from "@/components/brand/ShelfDealLogo";

export default function Home() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-lg justify-center px-4 pt-2 pb-1">
        <ShelfDealLogo variant="full" size="lg" />
      </div>
      <HomeClient />
    </AppShell>
  );
}
