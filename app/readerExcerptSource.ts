export type ReaderExcerptSource = {
  bookId: string;
  bookTitle: string;
  bookVersion: string;
  chapterId: string;
  chapterTitle: string;
  paragraphIndex: number;
  characterOffset: number;
};

export function isReaderExcerptSource(value: unknown): value is ReaderExcerptSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<ReaderExcerptSource>;
  return typeof source.bookId === "string" && source.bookId.length > 0
    && typeof source.bookTitle === "string"
    && typeof source.bookVersion === "string"
    && typeof source.chapterId === "string" && source.chapterId.length > 0
    && typeof source.chapterTitle === "string"
    && Number.isInteger(source.paragraphIndex) && source.paragraphIndex! >= 0
    && Number.isInteger(source.characterOffset) && source.characterOffset! >= 0;
}

export function readerSourcesMatch(left?: ReaderExcerptSource, right?: ReaderExcerptSource) {
  if (!left || !right) return left === right;
  return left.bookId === right.bookId && left.bookTitle === right.bookTitle
    && left.bookVersion === right.bookVersion && left.chapterId === right.chapterId
    && left.chapterTitle === right.chapterTitle && left.paragraphIndex === right.paragraphIndex
    && left.characterOffset === right.characterOffset;
}
