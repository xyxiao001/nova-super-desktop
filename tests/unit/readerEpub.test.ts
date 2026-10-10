import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isReaderExcerptSource, readerSourcesMatch, type EpubExcerptSource } from "../../app/readerExcerptSource";
import { encodeEpub, decodeEpub, isEpubBook, type EpubBookmark, type EpubLocation } from "../../src/apps/reader/epubCore";
import { getStoredBook, getStoredBookSummaries, storeBook } from "../../src/apps/reader/readerStorage";
import { readEpubLocation, saveEpubLocation, readReaderBookmarks, saveReaderBookmarks, removeReaderBookData } from "../../src/apps/reader/readerPersistence";
import provider from "../../src/apps/reader/storageProvider";
import desktopProvider from "../../src/platform/storage/providers/desktop";
import type { StoredBook } from "../../src/apps/reader/readerCore";
import { serviceWorkerResourcePackages } from "../../app/resourcePackageManifest";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
});
afterEach(async () => { vi.unstubAllGlobals(); await deleteDB("nova-reader-library"); });

const source: EpubExcerptSource = { format: "epub", bookId: "epub", bookTitle: "图文阅读", bookVersion: "1", chapterTitle: "第二章", cfi: "epubcfi(/6/4!/4/2:8)" };
const location: EpubLocation = { format: "epub", cfi: source.cfi, fraction: 0.42, chapterTitle: source.chapterTitle, href: "chapter2.xhtml", excerpt: "保留原书图文" };

describe("EPUB reader persistence", () => {
  it("preserves every binary byte across chunked encoding and JSON backup/restore", async () => {
    const bytes = Uint8Array.from({ length: 100003 }, (_, index) => index % 256);
    const book: StoredBook = { id: "epub", format: "epub", title: "图文阅读", author: "测试", file: "reading.epub", url: "", description: "", cover: "slate", version: "1", size: bytes.length, downloadedAt: 1, source: "local", content: encodeEpub(bytes.buffer) };
    await storeBook(book);
    const exported = JSON.parse(JSON.stringify(await provider.exportData()));
    expect(provider.validateData(exported)).toBe(true);
    await provider.clear();
    await provider.restoreData(exported);
    expect(decodeEpub((await getStoredBook(book.id))!.content)).toEqual(bytes);
    const [summary] = await getStoredBookSummaries();
    expect(summary.format).toBe("epub");
    expect(summary).not.toHaveProperty("content");
    expect((await provider.inspect()).bytes).toBeGreaterThan(bytes.length);
  });

  it("restores CFI progress and bookmarks and deletes both with the book", () => {
    expect(readEpubLocation("epub")).toBeNull();
    saveEpubLocation("epub", location);
    const bookmark: EpubBookmark = { ...location, id: "bookmark", bookId: "epub", createdAt: 1 };
    saveReaderBookmarks("epub", [bookmark]);
    expect(readEpubLocation("epub")).toEqual(location);
    expect(readReaderBookmarks<EpubBookmark>("epub")).toEqual([bookmark]);
    removeReaderBookData("epub");
    expect(readEpubLocation("epub")).toBeNull();
    expect(readReaderBookmarks("epub")).toEqual([]);
  });

  it("keeps EPUB excerpt backlinks in the existing desktop backup schema", () => {
    const note = { id: "note", type: "text", name: "摘录.txt", content: "原文", parentId: null, createdAt: 1, readerSource: source };
    expect(isReaderExcerptSource(source)).toBe(true);
    expect(desktopProvider.validateData([JSON.parse(JSON.stringify(note))])).toBe(true);
    expect(readerSourcesMatch(source, { ...source })).toBe(true);
    expect(readerSourcesMatch(source, { ...source, cfi: "epubcfi(/6/6!/4/2:0)" })).toBe(false);
    expect(isReaderExcerptSource({ ...source, cfi: "" })).toBe(false);
  });

  it("routes EPUB files and resources without changing TXT format defaults", () => {
    expect(isEpubBook({ file: "BOOK.EPUB" })).toBe(true);
    expect(isEpubBook({ file: "download", format: "epub" })).toBe(true);
    expect(isEpubBook({ file: "book.txt" })).toBe(false);
    expect(serviceWorkerResourcePackages().find(item => item.id === "books")!.pathPrefixes).toContain("/reader/");
  });
});
