export type TextMatch = {
  start: number;
  end: number;
};

export type TextSearchResult = TextMatch & {
  excerpt: string;
};

export function allTextMatches(content: string, query: string): TextMatch[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const normalizedContent = content.toLocaleLowerCase();
  const matches: TextMatch[] = [];
  let start = normalizedContent.indexOf(normalizedQuery);
  while (start >= 0) {
    matches.push({ start, end: start + normalizedQuery.length });
    start = normalizedContent.indexOf(normalizedQuery, start + normalizedQuery.length);
  }
  return matches;
}

export function nextTextMatchIndex(current: number, count: number, direction: 1 | -1) {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}

export function firstTextMatch(content: string, query: string): TextMatch | null {
  return allTextMatches(content, query)[0] ?? null;
}

export function textSearchResult(content: string, query: string, contextLength = 28): TextSearchResult | null {
  const match = firstTextMatch(content, query);
  if (!match) return null;
  const prefixStart = Math.max(0, match.start - contextLength);
  const suffixEnd = Math.min(content.length, match.end + contextLength);
  const excerpt = content.slice(prefixStart, suffixEnd).replace(/\s+/g, " ").trim();
  return {
    ...match,
    excerpt: `${prefixStart > 0 ? "…" : ""}${excerpt}${suffixEnd < content.length ? "…" : ""}`,
  };
}
