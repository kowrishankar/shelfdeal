import { extractPackInfo } from "../product-matching";
import type { PriceLine, RetailerListing } from "../types";
import type { RetailerSearchHit } from "./search/types";

/** Public client key embedded in Tesco's grocery web app (not a secret). */
const TESCO_XAPI_KEY = "TvOSZJHlEk0pjniDGQFAc9Q59WGAR4dA";
const TESCO_XAPI_URL = "https://xapi.tesco.com/";
const XAPI_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "x-apikey": TESCO_XAPI_KEY,
  Origin: "https://www.tesco.com",
  Referer: "https://www.tesco.com/groceries/",
  language: "en-GB",
  region: "UK",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
} as const;

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

interface TescoPromotion {
  promotionType?: string | null;
  description?: string | null;
  price?: {
    beforeDiscount?: number | null;
    afterDiscount?: number | null;
  } | null;
}

interface TescoSellerResult {
  isForSale?: boolean;
  status?: string;
  price?: {
    actual?: number;
  };
  promotions?: TescoPromotion[];
}

interface TescoProductNode {
  id?: string;
  tpnc?: string;
  tpnb?: string;
  title?: string;
  defaultImageUrl?: string;
  sellers?: {
    results?: TescoSellerResult[];
  };
}

interface TescoProductResponse {
  data?: {
    product?: TescoProductNode | null;
  };
  errors?: Array<{ message?: string }>;
}

function tescoProductUrl(tpnc: string): string {
  return `https://www.tesco.com/shop/en-GB/products/${tpnc}`;
}

export function normalizeTescoProductUrl(url: string): string {
  return url.replace(
    /https:\/\/www\.tesco\.com\/groceries\/en-GB\/products\/(\d+)/i,
    "https://www.tesco.com/shop/en-GB/products/$1",
  );
}

export function extractTescoTpncFromUrl(url: string): string | null {
  const match = normalizeTescoProductUrl(url).match(/\/products\/(\d+)/i);
  return match?.[1] ?? null;
}

const PRODUCT_QUERY = `query ProductByTpnc($tpnc: String!) {
  product(tpnc: $tpnc) {
    id
    tpnc
    tpnb
    title
    defaultImageUrl
    sellers(type: TOP, limit: 1, offset: 0) {
      results {
        isForSale
        status
        price {
          actual
        }
        promotions {
          promotionType
          description
          price {
            beforeDiscount
            afterDiscount
          }
        }
      }
    }
  }
}`;

async function postTescoXapi<T>(body: unknown): Promise<T> {
  const response = await fetch(TESCO_XAPI_URL, {
    method: "POST",
    headers: XAPI_HEADERS,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Tesco xAPI HTTP ${response.status}`);
  }
  return (await response.json()) as T;
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

  const json = await postTescoXapi<TescoSearchResponse[]>(body);
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

export async function fetchTescoProductViaXapi(
  productUrl: string,
): Promise<RetailerListing | null> {
  const tpnc = extractTescoTpncFromUrl(productUrl);
  if (!tpnc) return null;
  const normalizedUrl = normalizeTescoProductUrl(productUrl);
  const fetchedAt = new Date().toISOString();

  const body = [
    {
      operationName: "ProductByTpnc",
      variables: { tpnc },
      extensions: { mfeName: "mfe-pdp" },
      query: PRODUCT_QUERY,
    },
  ];
  const json = await postTescoXapi<TescoProductResponse[]>(body);
  const first = json[0];
  if (first?.errors?.length) {
    const message = first.errors[0]?.message ?? "Tesco xAPI product failed";
    throw new Error(message);
  }

  const product = first?.data?.product;
  if (!product) return null;
  const seller = product.sellers?.results?.[0];
  const prices: PriceLine[] = [];
  const standard = seller?.price?.actual;
  if (typeof standard === "number" && Number.isFinite(standard)) {
    prices.push({
      kind: "standard",
      label: "Price",
      amount: standard,
      currency: "GBP",
    });
  }
  for (const promo of seller?.promotions ?? []) {
    const after = promo.price?.afterDiscount;
    if (typeof after !== "number" || !Number.isFinite(after)) continue;
    const isClubcard = /clubcard/i.test(promo.description ?? "");
    prices.push({
      kind: isClubcard ? "clubcard" : "promo",
      label: isClubcard ? "Clubcard" : "Offer",
      amount: after,
      currency: "GBP",
    });
  }
  if (!prices.length) return null;

  return {
    retailerId: "tesco",
    retailerName: "Tesco",
    productName: product.title ?? "Product",
    url: normalizedUrl,
    imageUrl: product.defaultImageUrl ?? undefined,
    inStock: seller?.isForSale ?? true,
    prices,
    sortPrice: Math.min(...prices.map((p) => p.amount)),
    fetchedAt,
  };
}
