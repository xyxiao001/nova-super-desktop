import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { duplicateDesktopItem, trashDesktopItems, restoreDesktopItems, permanentlyDeleteDesktopItems, type DesktopItem } from "../../app/desktopFiles";
import { createDesktopSyncQueue, loadDesktopFile, replaceDesktopItems } from "../../app/desktopStorage";
import { createAppLaunchIntent, launchIntentFor } from "../../app/appLaunch";
import { isReaderExcerptSource, type ReaderExcerptSource } from "../../app/readerExcerptSource";
import { createChapterIndex, readerExcerpt, type StoredBook } from "../../src/apps/reader/readerCore";
import { excerptLocation, captureReaderExcerpt } from "../../src/apps/reader/readerExcerpt";
import desktopProvider from "../../src/platform/storage/providers/desktop";

const parsed = createChapterIndex(readFileSync(new URL("../fixtures/reader-backlink.txt", import.meta.url), "utf8"));
const book: StoredBook = { id: "book", title: "回链测试", author: "测试", version: "local", content: parsed.content, chapterIndex: parsed.chapters, description: "", cover: "slate", file: "book.txt", url: "", size: 0, downloadedAt: 1 };
const source: ReaderExcerptSource = { bookId: book.id, bookTitle: book.title, bookVersion: book.version, chapterId: parsed.chapters[0].id, chapterTitle: parsed.chapters[0].title, paragraphIndex: 1, characterOffset: 3 };
const note: DesktopItem = { id: "note", type: "text", name: "摘录.txt", content: "一段摘录", parentId: null, createdAt: 1, readerSource: source };
const storage = { getItem: () => null, removeItem: () => {} };
afterEach(async () => { vi.unstubAllGlobals(); await deleteDB("nova-desktop"); });

describe("reader excerpt backlinks", () => {
  it("retains readable text and structured source together", () => {
    const result = readerExcerpt(book.title, source.chapterTitle, "  一段摘录  ", source);
    expect(result.content).toBe(`一段摘录\n\n摘自《${book.title}》 · ${source.chapterTitle}`);
    expect(result.readerSource).toEqual(source);
    expect(excerptLocation(book, parsed.chapters, source)).toMatchObject({ chapterIndex: 0, paragraphIndex: 1, characterOffset: 3 });
    const launch = createAppLaunchIntent(1, { app: "reader", kind: "book", bookId: book.id, source });
    expect(launchIntentFor(launch, "reader")?.source).toEqual(source);
  });

  it.each([
    { bookId: "missing" }, { bookVersion: "different" }, { chapterId: "missing" },
    { paragraphIndex: 99 }, { characterOffset: 999 }, { characterOffset: -1 },
  ])("rejects unavailable source positions %j without guessing", (patch) => {
    expect(excerptLocation(book, parsed.chapters, { ...source, ...patch })).toBeNull();
  });

  it("does not create a source from a missing selection", () => {
    expect(captureReaderExcerpt(null, null, book, parsed.chapters)).toBeNull();
    expect(readerExcerpt("旧书", "旧章", "旧摘录")).not.toHaveProperty("readerSource");
  });

  it("validates the optional metadata without rejecting existing notes", () => {
    expect(isReaderExcerptSource(source)).toBe(true);
    expect(desktopProvider.validateData([{ ...note, readerSource: undefined }])).toBe(true);
    for (const invalid of [null, {}, { ...source, paragraphIndex: -1 }, { ...source, characterOffset: 1.5 }]) {
      expect(isReaderExcerptSource(invalid)).toBe(false);
      expect(desktopProvider.validateData([{ ...note, readerSource: invalid }])).toBe(false);
    }
    expect(desktopProvider.validateData([{ ...note, type: "image" }])).toBe(false);
  });

  it("persists source-only changes and restores exported metadata", async () => {
    vi.stubGlobal("localStorage", storage);
    await replaceDesktopItems([note]);
    const sync = createDesktopSyncQueue([note]);
    const changed = { ...note, readerSource: { ...source, characterOffset: 5 } };
    expect(sync.getItemStatus(changed)).toBe("saving");
    await sync.enqueue([changed]);
    expect(sync.getItemStatus(changed)).toBe("saved");
    expect(await loadDesktopFile(note.id, storage)).toEqual(changed);
    const backup = JSON.parse(JSON.stringify(await desktopProvider.exportData()));
    await desktopProvider.restoreData(backup);
    expect(await loadDesktopFile(note.id, storage)).toEqual(changed);
    await desktopProvider.clear();
    expect(await loadDesktopFile(note.id, storage)).toBeNull();
  });

  it("keeps the source across copying, trashing and restoring", () => {
    const copied = duplicateDesktopItem([note], note.id, null, () => "copy", 2);
    expect(copied.find((entry) => entry.id === "copy")?.readerSource).toEqual(source);
    const trashed = trashDesktopItems(copied, ["copy"]);
    const restored = restoreDesktopItems(trashed, ["copy"]);
    expect(restored.items.find((entry) => entry.id === "copy")?.readerSource).toEqual(source);
    const deleted = permanentlyDeleteDesktopItems(restored.items, ["copy"]);
    expect(deleted.items).toEqual([note]);
  });
});
