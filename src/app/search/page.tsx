import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SearchResultsClient } from "@/components/search/SearchResultsClient";

export const metadata = {
  title: "Choose product | Bargain Goods",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <AppShell title="Choose a product" subtitle={query || "Search"}>
      <div className="mx-auto max-w-4xl px-4 py-4">
        <Link href="/" className="link-accent inline-flex items-center gap-1 text-sm">
          ← New search
        </Link>

        {query ? (
          <div className="mt-4">
            <SearchResultsClient query={query} />
          </div>
        ) : (
          <div className="surface-card mt-4 p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              Enter a product name on the home screen to see matches.
            </p>
            <Link href="/" className="link-accent mt-4 inline-block text-sm">
              Go to search →
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
