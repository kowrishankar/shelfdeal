export function scoreTitleMatch(query: string, title: string): number {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  const t = title.toLowerCase();
  if (!q.length) return 0;

  let score = 0;
  for (const token of q) {
    if (t.includes(token)) score += 1;
  }

  if (t.includes(query.toLowerCase())) score += q.length;
  if (/\b70\s*cl\b/i.test(t) && /\b70\b/.test(query)) score += 2;
  if (/\b12\b/.test(t) && /\b12\b/.test(query)) score += 1;

  return score;
}

export function pickBestMatch<T extends { name: string }>(
  query: string,
  hits: T[],
): T | undefined {
  if (!hits.length) return undefined;
  return [...hits].sort(
    (a, b) => scoreTitleMatch(query, b.name) - scoreTitleMatch(query, a.name),
  )[0];
}
