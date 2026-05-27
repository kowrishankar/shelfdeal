import { NextRequest } from "next/server";
import { streamPriceComparison, type StreamEvent } from "@/lib/compare-stream";
import { decodeVariantSelection } from "@/lib/variant-selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function encode(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: NextRequest) {
  const sel = request.nextUrl.searchParams.get("sel");
  const selection = sel ? decodeVariantSelection(sel) : null;
  const rawSelection = selection?.name?.trim();
  const q =
    rawSelection ??
    request.nextUrl.searchParams.get("q")?.trim() ??
    "";
  const productIdParam = request.nextUrl.searchParams.get("productId") ?? undefined;
  /** Selection from discovery re-searches all retailers with the displayed product text */
  const productId = rawSelection ? undefined : productIdParam;
  const preselected = rawSelection
    ? { canonicalName: rawSelection, listings: [] }
    : undefined;

  if (!q && !productId) {
    return new Response("q or productId required", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of streamPriceComparison(q, productId, preselected)) {
          controller.enqueue(encoder.encode(encode(event)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        controller.enqueue(
          encoder.encode(
            encode({
              type: "error",
              message,
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
