import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import type { StoredBook } from "../../app/readerCore";
import {
  getAllStoredBooks,
  getStoredBook,
  getStoredBookSummaries,
  replaceStoredBooks,
} from "../../app/readerStorage";

const book: StoredBook = {
  id: "local:book",
  title: "测试书籍",
  author: "NOVA",
  description: "本地备份测试",
  cover: "",
  file: "book.txt",
  url: "",
  size: 4,
  version: "1",
  content: "正文",
  downloadedAt: 100,
  source: "local",
  readerVersion: 2,
  chapterIndex: [{
    id: "chapter:0",
    title: "正文",
    start: 0,
    end: 2,
    characterCount: 2,
    paragraphCount: 1,
  }],
};

afterEach(async () => {
  await deleteDB("nova-reader-library");
});

describe("readerStorage backup replacement", () => {
  it("replaces books and rebuilds matching lightweight summaries", async () => {
    await replaceStoredBooks([book]);

    await expect(getAllStoredBooks()).resolves.toEqual([book]);
    await expect(getStoredBook("local:book")).resolves.toEqual(book);
    await expect(getStoredBookSummaries()).resolves.toEqual([
      expect.objectContaining({
        id: "local:book",
        title: "测试书籍",
        source: "local",
      }),
    ]);
  });

  it("removes books and summaries absent from the restored backup", async () => {
    await replaceStoredBooks([book]);
    await replaceStoredBooks([]);

    await expect(getAllStoredBooks()).resolves.toEqual([]);
    await expect(getStoredBookSummaries()).resolves.toEqual([]);
  });
});
