/** Extract a product image URL from HTML or JSON fragments */
export function extractImageFromHtml(html: string): string | undefined {
  const patterns = [
    /"defaultImageUrl":"(https?:\\?\/\\?\/[^"\\]+)"/i,
    /"imageUrl":"(https?:\\?\/\\?\/[^"\\]+)"/i,
    /"image":"(https?:\\?\/\\?\/[^"\\]+\.(?:jpg|jpeg|png|webp)[^"\\]*)"/i,
    /"thumbnail":"(https?:\\?\/\\?\/[^"\\]+)"/i,
    /src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i,
    /data-src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i,
    /src="(https:\/\/digitalcontent\.api\.tesco\.com\/[^"]+)"/i,
    /src="(https:\/\/[^"]*booker\.co\.uk[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    /src="(https:\/\/[^"]*asda\.com[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    /src="(https:\/\/[^"]*morrisons\.com[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    /(https:\/\/[^"\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"\\]*)?)/i,
  ];

  for (const pat of patterns) {
    const m = html.match(pat);
    if (m?.[1]) {
      const url = m[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
      if (url.startsWith("http") && !url.includes("sprite") && !url.includes("logo")) {
        return url;
      }
    }
  }
  return undefined;
}

export function normalizeImageUrl(url: string): string {
  return url.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
}
