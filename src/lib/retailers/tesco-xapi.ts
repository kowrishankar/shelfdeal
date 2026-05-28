import { extractPackInfo } from "../product-matching";
import type { RetailerSearchHit } from "./search/types";

/** Public client key embedded in Tesco's grocery web app (not a secret). */
const TESCO_XAPI_KEY = "TvOSZJHlEk0pjniDGQFAc9Q59WGAR4dA";
const TESCO_XAPI_URL = "https://xapi.tesco.com/";

/** Trimmed Search query — enough fields for discovery (full query is 20k+ chars). */
const SEARCH_QUERY = `query Search($query: String!, $page: Int = 1, $count: Int, $sortBy: String) {
  search(
    query: $query
    page: $page
    count: $count
    sortBy: $sortBy
    filterCriteria: [{ name: "inputType", values: ["free text"] }]
  ) {
    results {
      node {
        ... on ProductType {
          id
          tpnb
          tpnc
          title
          defaultImageUrl
        }
      }
      __typename
    }
    __typename
  }
}`;

interface TescoSearchNode {
  id?: string;
  tpnb?: string;
  tpnc?: string;
  title?: string;
  defaultImageUrl?: string;
}

interface TescoSearchResponse {
  data?: {
    search?: {
      results?: Array<{ node?: TescoSearchNode | null } | null>;
    };
  };
  errors?: Array<{ message?: string }>;
}

function tescoProductUrl(tpnc: string): string {
  return `https://www.tesco.com/groceries/en-GB/products/${tpnc}`;
}

export async function searchTescoViaXapi(
  query: string,
  count = 8,
): Promise<RetailerSearchHit[]> {
  const body = [
    {
      operationName: "Search",
      variables: {
        query: query.trim(),
        page: 1,
        count,
        sortBy: "relevance",
      },
      extensions: { mfeName: "mfe-plp" },
      query: SEARCH_QUERY,
    },
  ];

  const response = await fetch(TESCO_XAPI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-apikey": TESCO_XAPI_KEY,
      Origin: "https://www.tesco.com",
      Referer: "https://www.tesco.com/groceries/",
      language: "en-GB",
      region: "UK",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Tesco xAPI HTTP ${response.status}`);
  }

  const json = (await response.json()) as TescoSearchResponse[];
  const first = json[0];
  if (first?.errors?.length) {
    throw new Error(first.errors[0]?.message ?? "Tesco xAPI search failed");
  }

  const hits: RetailerSearchHit[] = [];
  const seen = new Set<string>();

  for (const row of first?.data?.search?.results ?? []) {
    const node = row?.node;
    if (!node?.title) continue;
    const tpnc = node.tpnc ?? node.id;
    if (!tpnc) continue;
    const url = tescoProductUrl(tpnc);
    if (seen.has(url)) continue;
    seen.add(url);

    const name = node.title.replace(/\\u0027/g, "'");
    hits.push({
      retailerId: "tesco",
      url,
      name,
      packLabel: extractPackInfo(name).packLabel,
      imageUrl: node.defaultImageUrl,
    });
  }

  return hits.slice(0, count);
}
