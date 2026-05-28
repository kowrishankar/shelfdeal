import { applyMultipackUnitPricing } from "../pack-pricing";
import type { RetailerListing } from "../types";
import { unavailable } from "./shared";

const CREATORS_BASE = "https://creatorsapi.amazon";
const UK_MARKETPLACE = "www.amazon.co.uk";

interface CreatorsConfig {
  credentialId: string;
  credentialSecret: string;
  version: string;
  partnerTag: string;
  marketplace: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function creatorsConfig(): CreatorsConfig | null {
  const credentialId = process.env.AMAZON_CREATORS_CREDENTIAL_ID?.trim();
  const credentialSecret = process.env.AMAZON_CREATORS_CREDENTIAL_SECRET?.trim();
  const partnerTag = process.env.AMAZON_PARTNER_TAG?.trim();
  if (!credentialId || !credentialSecret || !partnerTag) return null;

  return {
    credentialId,
    credentialSecret,
    version: process.env.AMAZON_CREATORS_VERSION?.trim() || "2.2",
    partnerTag,
    marketplace: process.env.AMAZON_MARKETPLACE?.trim() || UK_MARKETPLACE,
  };
}

export function isAmazonCreatorsConfigured(): boolean {
  return creatorsConfig() != null;
}

function tokenEndpoint(version: string): string {
  switch (version) {
    case "2.1":
      return "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token";
    case "2.2":
      return "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token";
    case "2.3":
      return "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token";
    case "3.1":
      return "https://api.amazon.com/auth/o2/token";
    case "3.2":
      return "https://api.amazon.co.uk/auth/o2/token";
    case "3.3":
      return "https://api.amazon.co.jp/auth/o2/token";
    default:
      throw new Error(`Unsupported AMAZON_CREATORS_VERSION: ${version}`);
  }
}

async function getAccessToken(config: CreatorsConfig): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const isLwa = config.version.startsWith("3.");
  const endpoint = tokenEndpoint(config.version);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: isLwa
      ? { "Content-Type": "application/json" }
      : { "Content-Type": "application/x-www-form-urlencoded" },
    body: isLwa
      ? JSON.stringify({
          grant_type: "client_credentials",
          client_id: config.credentialId,
          client_secret: config.credentialSecret,
          scope: "creatorsapi::default",
        })
      : new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.credentialId,
          client_secret: config.credentialSecret,
          scope: "creatorsapi/default",
        }).toString(),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error ?? `Amazon Creators token HTTP ${response.status}`,
    );
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

function readDisplayValue(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object" && "displayValue" in value) {
    const display = (value as { displayValue?: unknown }).displayValue;
    return typeof display === "string" ? display.trim() || undefined : undefined;
  }
  return undefined;
}

function parseMoneyAmount(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const money = value as { amount?: unknown; displayAmount?: unknown };
  if (typeof money.amount === "number" && Number.isFinite(money.amount)) {
    return money.amount;
  }
  if (typeof money.displayAmount === "string") {
    const parsed = parseFloat(money.displayAmount.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function listingFromCreatorsItem(
  item: Record<string, unknown>,
  url: string,
  fetchedAt: string,
): RetailerListing | null {
  const name =
    readDisplayValue(
      (item.itemInfo as { title?: unknown } | undefined)?.title,
    ) ?? undefined;
  const imageUrl =
    (
      item.images as
        | { primary?: { medium?: { url?: string } } }
        | undefined
    )?.primary?.medium?.url ?? undefined;

  const listings =
    (item.offersV2 as { listings?: unknown[] } | undefined)?.listings ?? [];
  const buyBox =
    listings.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as { isBuyBoxWinner?: boolean }).isBuyBoxWinner,
    ) ?? listings[0];

  const priceBlock =
    buyBox && typeof buyBox === "object"
      ? (buyBox as { price?: { money?: unknown } }).price?.money
      : undefined;
  const amount = parseMoneyAmount(priceBlock);
  if (amount == null) return null;

  const availability = (
    buyBox as { availability?: { type?: string } } | undefined
  )?.availability?.type;

  return applyMultipackUnitPricing({
    retailerId: "amazon",
    retailerName: "Amazon",
    productName: name ?? "Product",
    url,
    imageUrl,
    inStock: availability ? availability !== "UNAVAILABLE" : true,
    prices: [
      {
        kind: "standard",
        label: "Amazon",
        amount,
        currency: "GBP",
      },
    ],
    sortPrice: amount,
    fetchedAt,
    note: "Price via Amazon Creators API — may vary by seller",
  });
}

export async function fetchAmazonPriceViaCreators(
  asin: string,
  url: string,
): Promise<RetailerListing> {
  const config = creatorsConfig();
  if (!config) {
    throw new Error("Amazon Creators API not configured");
  }

  const fetchedAt = new Date().toISOString();
  const token = await getAccessToken(config);
  const authHeader = config.version.startsWith("3.")
    ? `Bearer ${token}`
    : `Bearer ${token}, Version ${config.version}`;

  const response = await fetch(`${CREATORS_BASE}/catalog/v1/getItems`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      "x-marketplace": config.marketplace,
    },
    body: JSON.stringify({
      partnerTag: config.partnerTag,
      itemIds: [asin],
      resources: [
        "itemInfo.title",
        "images.primary.medium",
        "offersV2.listings.price",
        "offersV2.listings.availability",
        "offersV2.listings.isBuyBoxWinner",
      ],
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    itemsResult?: { items?: Record<string, unknown>[] };
    errors?: { code?: string; message?: string }[];
  };

  if (!response.ok) {
    const message =
      data.errors?.[0]?.message ??
      `Amazon Creators HTTP ${response.status}`;
    throw new Error(message);
  }

  const item = data.itemsResult?.items?.[0];
  if (!item) {
    return unavailable(
      "amazon",
      url,
      fetchedAt,
      "Product not found in Amazon catalogue",
    );
  }

  const listing = listingFromCreatorsItem(item, url, fetchedAt);
  if (!listing) {
    throw new Error("Amazon Creators returned no price for this ASIN");
  }
  return listing;
}
