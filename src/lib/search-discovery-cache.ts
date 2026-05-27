import type { DiscoverSearchResponse } from "@/lib/search-types";

const CACHE_PREFIX = "bg:discover:";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedDiscover {
  savedAt: number;
  data: DiscoverSearchResponse;
}

function cacheKey(query: string): string {
  return `${CACHE_PREFIX}${query.trim().toLowerCase()}`;
}

export function readDiscoverCache(
  query: string,
): DiscoverSearchResponse | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDiscover;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(query));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeDiscoverCache(
  query: string,
  data: DiscoverSearchResponse,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: CachedDiscover = { savedAt: Date.now(), data };
    sessionStorage.setItem(cacheKey(query), JSON.stringify(payload));
  } catch {
    /* quota exceeded — ignore */
  }
}
