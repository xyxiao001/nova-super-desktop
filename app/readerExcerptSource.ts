type ReaderSourceBook = {
  bookId: string;
  bookTitle: string;
  bookVersion: string;
  chapterTitle: string;
};

export type EpubExcerptSource = ReaderSourceBook & {
  format: "epub";
  cfi: string;
};

export type TextExcerptSource = ReaderSourceBook & {
  format?: "txt";
  chapterId: string;
  paragraphIndex: number;
  characterOffset: number;
};

export type ReaderExcerptSource = TextExcerptSource | EpubExcerptSource;

export function isReaderExcerptSource(value: unknown): value is ReaderExcerptSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<Omit<TextExcerptSource, "format">> & { format?: string; cfi?: string };
  return typeof source.bookId === "string" && source.bookId.length > 0
    && typeof source.bookTitle === "string"
    && typeof source.bookVersion === "string"
    && typeof source.chapterTitle === "string"
    && (source.format === "epub"
      ? typeof source.cfi === "string" && source.cfi.length > 0
      : typeof source.chapterId === "string" && source.chapterId.length > 0
        && Number.isInteger(source.paragraphIndex) && source.paragraphIndex! >= 0
        && Number.isInteger(source.characterOffset) && source.characterOffset! >= 0);
}

export function readerSourcesMatch(left?: ReaderExcerptSource, right?: ReaderExcerptSource) {
  if (!left || !right) return left === right;
  return left.bookId === right.bookId && left.bookTitle === right.bookTitle
    && left.bookVersion === right.bookVersion && left.chapterTitle === right.chapterTitle
    && (left.format === "epub" || right.format === "epub"
      ? left.format === "epub" && right.format === "epub" && left.cfi === right.cfi
      : left.chapterId === right.chapterId && left.paragraphIndex === right.paragraphIndex
        && left.characterOffset === right.characterOffset);
}
