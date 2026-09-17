import type { ReaderExcerptSource } from "../../../app/readerExcerptSource";
import { chapterParagraphs, READER_DATA_VERSION, type ReaderChapter, type ReaderLocation, type StoredBook } from "./readerCore";

export function excerptLocation(book: StoredBook, chapters: ReaderChapter[], source: ReaderExcerptSource): ReaderLocation | null {
  if (book.id !== source.bookId || book.version !== source.bookVersion) return null;
  const chapterIndex = chapters.findIndex((chapter) => chapter.id === source.chapterId);
  if (chapterIndex < 0) return null;
  const paragraph = chapterParagraphs(book.content, chapters[chapterIndex])[source.paragraphIndex];
  if (!paragraph || source.characterOffset < 0 || source.characterOffset >= paragraph.text.length) return null;
  return {
    version: READER_DATA_VERSION,
    chapterId: source.chapterId,
    chapterIndex,
    paragraphIndex: source.paragraphIndex,
    characterOffset: source.characterOffset,
    pageIndex: 0,
    scrollProgress: 0,
    updatedAt: Date.now(),
  };
}

export function captureReaderExcerpt(selection: Selection | null, stage: HTMLElement | null, book: StoredBook, chapters: ReaderChapter[]) {
  if (!selection || selection.isCollapsed || !selection.rangeCount || !stage) return null;
  const range = selection.getRangeAt(0);
  if (!stage.contains(range.startContainer) || !stage.contains(range.endContainer)) return null;
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as Element : range.startContainer.parentElement;
  const paragraph = startElement?.closest<HTMLElement>("[data-reader-paragraph]");
  const chapterId = paragraph?.closest<HTMLElement>("[data-reader-chapter]")?.dataset.readerChapter;
  const chapter = chapters.find((entry) => entry.id === chapterId);
  const text = selection.toString();
  if (!paragraph || !chapter || !text.trim()) return null;
  const before = range.cloneRange();
  before.selectNodeContents(paragraph);
  before.setEnd(range.startContainer, range.startOffset);
  const source: ReaderExcerptSource = {
    bookId: book.id,
    bookTitle: book.title,
    bookVersion: book.version,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    paragraphIndex: Number(paragraph.dataset.readerParagraph),
    characterOffset: before.toString().length + text.length - text.trimStart().length,
  };
  if (!excerptLocation(book, chapters, source)) return null;
  return { text: text.trim(), source };
}
