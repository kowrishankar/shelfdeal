const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface FetchHtmlOptions {
  cookie?: string;
  referer?: string;
  /** Visit site root first to collect session cookies (helps Tesco/Booker on serverless). */
  warmOrigin?: string;
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

async function warmOriginCookies(origin: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${origin}/`, {
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
      ...(typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : []
      ).map((c) => c.split(";")[0]),
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
  if (options?.warmOrigin) {
    cookie = mergeCookies(cookie, await warmOriginCookies(options.warmOrigin));
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

  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}
