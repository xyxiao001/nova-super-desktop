export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; children: MarkdownInline[] }
  | { type: "emphasis"; children: MarkdownInline[] }
  | { type: "strike"; children: MarkdownInline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: MarkdownInline[] }
  | { type: "image"; alt: string };

export type MarkdownBlock =
  | { type: "heading"; level: number; children: MarkdownInline[] }
  | { type: "paragraph"; children: MarkdownInline[] }
  | { type: "quote"; children: MarkdownInline[] }
  | { type: "code"; language: string; text: string }
  | { type: "list"; ordered: boolean; items: Array<{ children: MarkdownInline[]; checked?: boolean }> }
  | { type: "rule" };

const inlinePattern = /(!\[[^\]]*\]\([^\s)]+\)|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;

export function safeMarkdownHref(href: string) {
  return /^(?:https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(href) ? href : null;
}

export function parseMarkdownInline(value: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  let cursor = 0;
  for (const match of value.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ type: "text", text: value.slice(cursor, index) });
    const token = match[0];
    if (token.startsWith("![")) {
      nodes.push({ type: "image", alt: token.slice(2, token.indexOf("]")) });
    } else if (token.startsWith("`")) {
      nodes.push({ type: "code", text: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      const href = token.slice(split + 2, -1);
      const safeHref = safeMarkdownHref(href);
      if (safeHref) nodes.push({ type: "link", href: safeHref, children: parseMarkdownInline(token.slice(1, split)) });
      else nodes.push({ type: "text", text: token });
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push({ type: "strong", children: parseMarkdownInline(token.slice(2, -2)) });
    } else if (token.startsWith("~~")) {
      nodes.push({ type: "strike", children: parseMarkdownInline(token.slice(2, -2)) });
    } else {
      nodes.push({ type: "emphasis", children: parseMarkdownInline(token.slice(1, -1)) });
    }
    cursor = index + token.length;
  }
  if (cursor < value.length) nodes.push({ type: "text", text: value.slice(cursor) });
  return nodes;
}

const unorderedItem = (line: string) => /^\s{0,3}[-+*]\s+(?:\[([ xX])\]\s+)?(.+)$/.exec(line);
const orderedItem = (line: string) => /^\s{0,3}\d+[.)]\s+(.+)$/.exec(line);
const isBlockStart = (line: string) => /^\s{0,3}(?:#{1,6}\s+|>|```|(?:[-*_]\s*){3,}$)/.test(line) || !!unorderedItem(line) || !!orderedItem(line);

export function parseMarkdown(value: string): MarkdownBlock[] {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const fence = /^\s{0,3}```([^\s`]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s{0,3}```\s*$/.test(lines[index])) body.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language: fence[1], text: body.join("\n") });
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, children: parseMarkdownInline(heading[2].trim()) });
      index += 1;
      continue;
    }
    if (/^\s{0,3}(?:[-*_]\s*){3,}$/.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s{0,3}>/.test(lines[index])) quote.push(lines[index++].replace(/^\s{0,3}>\s?/, ""));
      blocks.push({ type: "quote", children: parseMarkdownInline(quote.join(" ")) });
      continue;
    }
    const unordered = unorderedItem(line);
    const ordered = orderedItem(line);
    if (unordered || ordered) {
      const isOrdered = !!ordered;
      const items: Array<{ children: MarkdownInline[]; checked?: boolean }> = [];
      while (index < lines.length) {
        const match = isOrdered ? orderedItem(lines[index]) : unorderedItem(lines[index]);
        if (!match) break;
        const text = isOrdered ? match[1] : match[2];
        const checked = isOrdered || match[1] === undefined ? undefined : match[1].toLowerCase() === "x";
        items.push({ children: parseMarkdownInline(text), ...(checked === undefined ? {} : { checked }) });
        index += 1;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) paragraph.push(lines[index++].trim());
    blocks.push({ type: "paragraph", children: parseMarkdownInline(paragraph.join(" ")) });
  }
  return blocks;
}
