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

import {
  clearAllNovaStorage,
  clearNovaStorageCategory,
  inspectNovaStorage,
} from "../../app/novaStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => {
  storageMocks.loadDesktopItems.mockReset().mockResolvedValue([]);
  storageMocks.deleteDesktopItems.mockReset().mockResolvedValue(undefined);
  storageMocks.getAllStoredBooks.mockReset().mockResolvedValue([]);
  storageMocks.replaceStoredBooks.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("novaStorage", () => {
  it("lists persisted NOVA data by category without including unrelated storage", async () => {
    localStorage.setItem("nova-game-records", "{}");
    localStorage.setItem("nova-reader-bookmarks", "[]");
    localStorage.setItem("nova-settings", "{}");
    localStorage.setItem("HumanBreak_settings", "{}");
    localStorage.setItem("unrelated", "keep");

    const categories = await inspectNovaStorage();

    expect(categories.find((item) => item.id === "games")?.entries).toBe(2);
    expect(categories.find((item) => item.id === "reading")?.entries).toBe(1);
    expect(categories.find((item) => item.id === "settings")?.entries).toBe(1);
  });

  it("clears only the selected local data category", async () => {
    localStorage.setItem("nova-game-records", "{}");
    localStorage.setItem("HumanBreak_settings", "{}");
    localStorage.setItem("nova-reader-bookmarks", "[]");

    await clearNovaStorageCategory("games");

    expect(localStorage.getItem("nova-game-records")).toBeNull();
    expect(localStorage.getItem("HumanBreak_settings")).toBeNull();
    expect(localStorage.getItem("nova-reader-bookmarks")).toBe("[]");
  });

  it("clears every managed user-data provider without touching unrelated storage", async () => {
    storageMocks.loadDesktopItems.mockResolvedValue([{ id: "desktop-file" }]);
    localStorage.setItem("nova-game-records", "{}");
    localStorage.setItem("nova-reader-bookmarks", "[]");
    localStorage.setItem("nova-focus-sessions", "[]");
    localStorage.setItem("nova-settings", "{}");
    localStorage.setItem("nova-custom-data", "value");
    localStorage.setItem("unrelated", "keep");

    await clearAllNovaStorage();

    expect(storageMocks.deleteDesktopItems).toHaveBeenCalledWith(["desktop-file"]);
    expect(storageMocks.replaceStoredBooks).toHaveBeenCalledWith([]);
    expect(localStorage.getItem("nova-game-records")).toBeNull();
    expect(localStorage.getItem("nova-reader-bookmarks")).toBeNull();
    expect(localStorage.getItem("nova-focus-sessions")).toBeNull();
    expect(localStorage.getItem("nova-settings")).toBeNull();
    expect(localStorage.getItem("nova-custom-data")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
});
