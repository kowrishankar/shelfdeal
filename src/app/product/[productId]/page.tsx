import { ProductPageClient } from "@/components/ProductPageClient";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";

export const metadata = {
  title: "Product",
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ q?: string; sel?: string; returnTo?: string }>;
}) {
  const { productId } = await params;
  const { q, sel, returnTo } = await searchParams;
  const query = q?.trim() ?? "";
  const backHref =
    returnTo?.startsWith("/") ? returnTo : undefined;

  return (
    <AppShell minimal>
      {query ? (
        <ProductPageClient
          productId={productId}
          query={query}
          selectionEncoded={sel}
          returnTo={backHref}
        />
      ) : (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-[var(--text-secondary)]">Missing search query.</p>
          <Link href="/" className="link-accent mt-4 inline-block">
            Back to search →
          </Link>
        </div>
      )}
    </AppShell>
  );
}
