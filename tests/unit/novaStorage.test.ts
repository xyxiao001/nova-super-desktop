import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  loadDesktopItems: vi.fn(),
  deleteDesktopItems: vi.fn(),
  getAllStoredBooks: vi.fn(),
  replaceStoredBooks: vi.fn(),
}));

vi.mock("../../app/desktopStorage", () => ({
  loadDesktopItems: storageMocks.loadDesktopItems,
  deleteDesktopItems: storageMocks.deleteDesktopItems,
}));

vi.mock("../../app/readerStorage", () => ({
  getAllStoredBooks: storageMocks.getAllStoredBooks,
  replaceStoredBooks: storageMocks.replaceStoredBooks,
}));

import { clearNovaStorageCategory, inspectNovaStorage } from "../../app/novaStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const cacheDelete = vi.fn();

beforeEach(() => {
  storageMocks.loadDesktopItems.mockReset().mockResolvedValue([]);
  storageMocks.deleteDesktopItems.mockReset().mockResolvedValue(undefined);
  storageMocks.getAllStoredBooks.mockReset().mockResolvedValue([]);
  storageMocks.replaceStoredBooks.mockReset().mockResolvedValue(undefined);
  cacheDelete.mockReset().mockResolvedValue(true);
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("caches", {
    keys: vi.fn().mockResolvedValue(["nova-pwa-v2:shell", "unrelated-cache"]),
    open: vi.fn().mockResolvedValue({
      keys: vi.fn().mockResolvedValue([new Request("https://nova.test/app.js")]),
      match: vi.fn().mockResolvedValue(new Response("cached")),
    }),
    delete: cacheDelete,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("novaStorage", () => {
  it("lists persisted NOVA data by category without including unrelated storage", async () => {
    localStorage.setItem("nova-game-records", "{}");
    localStorage.setItem("nova-reader-bookmarks", "[]");
    localStorage.setItem("nova-settings", "{}");
    localStorage.setItem("unrelated", "keep");

    const categories = await inspectNovaStorage();

    expect(categories.find((item) => item.id === "games")?.entries).toBe(1);
    expect(categories.find((item) => item.id === "reading")?.entries).toBe(1);
    expect(categories.find((item) => item.id === "settings")?.entries).toBe(1);
    expect(categories.find((item) => item.id === "offline")).toMatchObject({
      entries: 1,
      bytes: 6,
      canClear: true,
    });
  });

  it("clears only the selected local data category", async () => {
    localStorage.setItem("nova-game-records", "{}");
    localStorage.setItem("nova-reader-bookmarks", "[]");

    await clearNovaStorageCategory("games");

    expect(localStorage.getItem("nova-game-records")).toBeNull();
    expect(localStorage.getItem("nova-reader-bookmarks")).toBe("[]");
  });

  it("deletes only NOVA-owned cache storage", async () => {
    await clearNovaStorageCategory("offline");

    expect(cacheDelete).toHaveBeenCalledOnce();
    expect(cacheDelete).toHaveBeenCalledWith("nova-pwa-v2:shell");
  });
});
