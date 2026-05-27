import { redirect } from "next/navigation";

export default async function IntelligenceProductRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { productId } = await params;
  const { q } = await searchParams;
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  redirect(`/product/${productId}${query}`);
}
