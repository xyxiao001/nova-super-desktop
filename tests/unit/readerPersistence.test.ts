import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_READER_PREFERENCES,
  READER_DATA_VERSION,
  type ReaderChapter,
  type ReaderLocation,
} from "../../app/readerCore";
import {
  readReaderActivity,
  readReaderBookmarks,
  readReaderLocation,
  readReaderPreferences,
  removeReaderBookData,
  saveReaderActivity,
  saveReaderBookmarks,
  saveReaderLocation,
  saveReaderPreferences,
} from "../../app/readerPersistence";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const chapters: ReaderChapter[] = [
  {
    id: "chapter:0",
    title: "第一章",
    start: 0,
    end: 10,
    characterCount: 10,
    paragraphCount: 1,
  },
  {
    id: "chapter:10",
    title: "第二章",
    start: 10,
    end: 20,
    characterCount: 10,
    paragraphCount: 1,
  },
];

describe("readerPersistence", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads defaults and normalizes legacy preferences", () => {
    expect(readReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES);

    localStorage.setItem(
      "nova-reader-preferences",
      JSON.stringify({
        theme: "invalid",
        fontSize: 99,
        lineHeight: 1,
        readingMode: "page",
        animation: "none",
      }),
    );

    expect(readReaderPreferences()).toEqual({
      theme: "paper",
      fontSize: 30,
      lineHeight: 1.5,
      readingMode: "page",
      animation: "none",
    });
  });

  it("round-trips preferences and updates location timestamps", () => {
    const preferences = {
      ...DEFAULT_READER_PREFERENCES,
      theme: "night" as const,
    };
    saveReaderPreferences(preferences);
    expect(readReaderPreferences()).toEqual(preferences);

    const location: ReaderLocation = {
      version: READER_DATA_VERSION,
      chapterId: "chapter:10",
      chapterIndex: 1,
      paragraphIndex: 2,
      characterOffset: 3,
      pageIndex: 4,
      scrollProgress: .5,
      updatedAt: 0,
    };
    saveReaderLocation("book-1", location);

    const saved = readReaderLocation("book-1", chapters);
    expect(saved).toMatchObject({
      ...location,
      updatedAt: expect.any(Number),
    });
    expect(saved.updatedAt).toBeGreaterThan(0);
  });

  it("migrates legacy locations and clamps invalid values", () => {
    localStorage.setItem(
      "nova-reader-progress:book-1",
      JSON.stringify({
        chapterIndex: 99,
        paragraphIndex: -3,
        characterOffset: Number.NaN,
        pageIndex: -1,
        scrollProgress: 5,
      }),
    );

    expect(readReaderLocation("book-1", chapters)).toMatchObject({
      chapterId: "chapter:10",
      chapterIndex: 1,
      paragraphIndex: 0,
      characterOffset: 0,
      pageIndex: 0,
      scrollProgress: 1,
    });
  });

  it("merges activity and keeps bookmarks isolated by book", () => {
    saveReaderActivity({
      bookId: "book-1",
      lastReadAt: 1,
      progress: 10,
      title: "Book One",
      author: "Author One",
    });
    const activity = saveReaderActivity({
      bookId: "book-2",
      lastReadAt: 2,
      progress: 20,
      title: "Book Two",
      author: "Author Two",
    });

    expect(Object.keys(activity)).toEqual(["book-1", "book-2"]);

    saveReaderBookmarks("book-1", [{
      id: "bookmark-1",
      bookId: "book-1",
      chapterId: "chapter:0",
      chapterTitle: "第一章",
      paragraphIndex: 0,
      characterOffset: 2,
      excerpt: "Alpha",
      createdAt: 1,
    }]);
    saveReaderBookmarks("book-2", []);

    expect(readReaderBookmarks("book-1")).toHaveLength(1);
    expect(readReaderBookmarks("book-2")).toEqual([]);
  });

  it("removes only the selected book's reading data", () => {
    const location = {
      version: READER_DATA_VERSION,
      chapterId: "chapter:0",
      chapterIndex: 0,
      paragraphIndex: 0,
      characterOffset: 0,
      pageIndex: 0,
      scrollProgress: 0,
      updatedAt: 1,
    } satisfies ReaderLocation;
    saveReaderLocation("book-1", location);
    saveReaderLocation("book-2", location);
    saveReaderActivity({
      bookId: "book-1",
      lastReadAt: 1,
      progress: 10,
      title: "Book One",
      author: "Author One",
    });
    saveReaderActivity({
      bookId: "book-2",
      lastReadAt: 2,
      progress: 20,
      title: "Book Two",
      author: "Author Two",
    });
    saveReaderBookmarks("book-1", [{
      id: "bookmark-1",
      bookId: "book-1",
      chapterId: "chapter:0",
      chapterTitle: "第一章",
      paragraphIndex: 0,
      characterOffset: 0,
      excerpt: "Alpha",
      createdAt: 1,
    }]);

    removeReaderBookData("book-1");

    expect(localStorage.getItem("nova-reader-progress:book-1")).toBeNull();
    expect(localStorage.getItem("nova-reader-progress:book-2")).not.toBeNull();
    expect(readReaderActivity()).toEqual({
      "book-2": expect.objectContaining({ bookId: "book-2" }),
    });
    expect(readReaderBookmarks("book-1")).toEqual([]);
  });

  it("[defect-probing] returns empty activity when browser storage is unavailable", () => {
    vi.unstubAllGlobals();

    expect(readReaderActivity()).toEqual({});
  });
});
