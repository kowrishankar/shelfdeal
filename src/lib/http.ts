const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export interface FetchHtmlOptions {
  cookie?: string;
}

export async function fetchHtml(
  url: string,
  options?: FetchHtmlOptions,
): Promise<string> {
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
  };
  if (options?.cookie) headers.Cookie = options.cookie;

  const response = await fetch(url, {
    headers,
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}
