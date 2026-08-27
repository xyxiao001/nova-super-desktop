export type CatalogBook = {
  id: string;
  title: string;
  author: string;
  description: string;
  cover: string;
  file: string;
  url: string;
  size: number;
  version: string;
};

export type ReaderChapter = {
  id: string;
  title: string;
  start: number;
  end: number;
  characterCount: number;
  paragraphCount: number;
};

export type StoredBook = CatalogBook & {
  content: string;
  downloadedAt: number;
  source?: "cloud" | "local";
  readerVersion?: number;
  chapterIndex?: ReaderChapter[];
};
export type StoredBookSummary = Omit<StoredBook, "content" | "chapterIndex">;

export type ReaderTheme = "paper" | "green" | "night";
export type ReadingMode = "scroll" | "page";
export type ReaderPreferences = {
  theme: ReaderTheme;
  fontSize: number;
  lineHeight: number;
  readingMode: ReadingMode;
  animation: "page" | "slide" | "none";
};

export type ReaderLocation = {
  version: 2;
  chapterId: string;
  chapterIndex: number;
  paragraphIndex: number;
  characterOffset: number;
  pageIndex: number;
  scrollProgress: number;
  updatedAt: number;
};

export type ReaderParagraph = {
  index: number;
  text: string;
  start: number;
  end: number;
};

export type ReaderSearchResult = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  paragraphIndex: number;
  characterOffset: number;
  excerpt: string;
};

export const READER_DATA_VERSION = 2;
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: "paper",
  fontSize: 18,
  lineHeight: 1.85,
  readingMode: "scroll",
  animation: "page",
};

const CHAPTER_PATTERN = /^(?:第[零一二三四五六七八九十百千万〇两0-9]+(?:卷(?:\s+第[零一二三四五六七八九十百千万〇两0-9]+章)?|[章节回篇部])[^\n]{0,36}|序(?:章|言)?|前言|楔子|引子|后记|尾声)\s*$/gm;

export function normalizeReaderText(content: string) {
  return content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function trimmedBounds(content: string, start: number, end: number) {
  while (start < end && /\s/.test(content[start])) start++;
  while (end > start && /\s/.test(content[end - 1])) end--;
  return { start, end };
}

function createChapter(content: string, title: string, start: number, end: number, allowEmpty = false): ReaderChapter | null {
  const bounds = trimmedBounds(content, start, end);
  if (bounds.start === bounds.end && !allowEmpty) return null;
  const body = content.slice(bounds.start, bounds.end);
  return {
    id: `chapter:${bounds.start}`,
    title,
    start: bounds.start,
    end: bounds.end,
    characterCount: body.length,
    paragraphCount: body.split(/\n+/).filter((line) => line.trim()).length,
  };
}

export function createChapterIndex(input: string) {
  const content = normalizeReaderText(input);
  const matches = [...content.matchAll(CHAPTER_PATTERN)];
  if (!matches.length) {
    return {
      content,
      chapters: [createChapter(content, "全文", 0, content.length, true)!],
    };
  }

  const chapters: ReaderChapter[] = [];
  const openingEnd = matches[0].index ?? 0;
  if (openingEnd > 0) {
    const opening = createChapter(content, "开始", 0, openingEnd);
    if (opening) chapters.push(opening);
  }
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    const chapter = createChapter(content, match[0].trim(), start, end);
    if (chapter) chapters.push(chapter);
  });
  if (!chapters.length) {
    const fallback = createChapter(content, "全文", 0, content.length, true);
    if (fallback) chapters.push(fallback);
  }
  return { content, chapters };
}

export function decodeReaderBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return normalizeReaderText(new TextDecoder("utf-8").decode(bytes.subarray(3)));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return normalizeReaderText(new TextDecoder("utf-16le").decode(bytes.subarray(2)));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return normalizeReaderText(new TextDecoder("utf-16be").decode(bytes.subarray(2)));
  }
  try {
    return normalizeReaderText(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return normalizeReaderText(new TextDecoder("gb18030").decode(bytes));
  }
}

export function chapterParagraphs(content: string, chapter: ReaderChapter): ReaderParagraph[] {
  const body = content.slice(chapter.start, chapter.end);
  const paragraphs: ReaderParagraph[] = [];
  for (const match of body.matchAll(/[^\n]+/g)) {
    const raw = match[0];
    const text = raw.trim();
    if (!text) continue;
    const leading = raw.length - raw.trimStart().length;
    const start = (match.index ?? 0) + leading;
    paragraphs.push({
      index: paragraphs.length,
      text,
      start,
      end: start + text.length,
    });
  }
  return paragraphs;
}

export function locationForOffset(paragraphs: ReaderParagraph[], offset: number) {
  if (!paragraphs.length) return { paragraphIndex: 0, characterOffset: 0 };
  const target = Math.max(0, offset);
  const paragraph = paragraphs.find((item) => target <= item.end) ?? paragraphs.at(-1)!;
  return {
    paragraphIndex: paragraph.index,
    characterOffset: Math.max(0, Math.min(paragraph.text.length, target - paragraph.start)),
  };
}
