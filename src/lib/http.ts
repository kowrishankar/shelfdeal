const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface FetchHtmlOptions {
  cookie?: string;
  referer?: string;
  /** Visit site root first to collect session cookies (helps Tesco/Booker on serverless). */
  warmOrigin?: string;
  /** Visit a specific URL for cookie warming (preferred over warmOrigin alone). */
  warmUrl?: string;
  /**
   * Route via ScraperAPI when SCRAPER_API_KEY is set (Booker/Tesco HTML on Vercel).
   * Ignored if the env var is missing.
   */
  scraperProxy?: boolean;
}

function mergeCookies(...parts: (string | undefined)[]): string | undefined {
  const merged = parts
    .flatMap((part) => (part ? part.split(";") : []))
    .map((c) => c.trim())
    .filter(Boolean);
  if (!merged.length) return undefined;
  const byName = new Map<string, string>();
  for (const entry of merged) {
    const [name, ...rest] = entry.split("=");
    if (!name) continue;
    byName.set(name.trim(), rest.join("="));
  }
  return [...byName.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function readSetCookies(response: Response): string[] {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function scraperProxyUrl(targetUrl: string): string | null {
  const key = process.env.SCRAPER_API_KEY?.trim();
  if (!key) return null;
  const params = new URLSearchParams({
    api_key: key,
    url: targetUrl,
    country_code: "gb",
  });
  return `https://api.scraperapi.com?${params}`;
}

async function warmSessionCookies(warmTarget: string): Promise<string | undefined> {
  try {
    const response = await fetch(warmTarget, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
    });
    return mergeCookies(
      ...readSetCookies(response).map((c) => c.split(";")[0]),
    );
  } catch {
    return undefined;
  }
}

export async function fetchHtml(
  url: string,
  options?: FetchHtmlOptions,
): Promise<string> {
  let cookie = options?.cookie;
  const warmTarget =
    options?.warmUrl ??
    (options?.warmOrigin ? `${options.warmOrigin.replace(/\/$/, "")}/` : undefined);
  if (warmTarget) {
    cookie = mergeCookies(cookie, await warmSessionCookies(warmTarget));
  }

  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Cache-Control": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": options?.referer ? "same-origin" : "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };
  if (cookie) headers.Cookie = cookie;
  if (options?.referer) {
    headers.Referer = options.referer;
    headers["Sec-Fetch-Site"] = "same-origin";
  }

  const fetchUrl =
    options?.scraperProxy && scraperProxyUrl(url) ? scraperProxyUrl(url)! : url;

  const response = await fetch(fetchUrl, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}
