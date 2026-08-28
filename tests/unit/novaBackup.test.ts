import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  loadDesktopItems: vi.fn(),
  replaceDesktopItems: vi.fn(),
  getAllStoredBooks: vi.fn(),
  replaceStoredBooks: vi.fn(),
}));

vi.mock("../../app/desktopStorage", () => ({
  loadDesktopItems: storageMocks.loadDesktopItems,
  replaceDesktopItems: storageMocks.replaceDesktopItems,
}));

vi.mock("../../app/readerStorage", () => ({
  getAllStoredBooks: storageMocks.getAllStoredBooks,
  replaceStoredBooks: storageMocks.replaceStoredBooks,
}));

import {
  createNovaBackup,
  parseNovaBackup,
  restoreNovaBackup,
  summarizeNovaBackup,
} from "../../app/novaBackup";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const backup = {
  version: 1 as const,
  exportedAt: "2026-08-27T12:00:00.000Z",
  desktopItems: [],
  readerBooks: [],
  localStorage: {
    "nova-settings": "{\"theme\":\"dark\"}",
  },
};

beforeEach(() => {
  storageMocks.loadDesktopItems.mockReset().mockResolvedValue([]);
  storageMocks.replaceDesktopItems.mockReset().mockResolvedValue(undefined);
  storageMocks.getAllStoredBooks.mockReset().mockResolvedValue([]);
  storageMocks.replaceStoredBooks.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("novaBackup", () => {
  it("normalizes and summarizes a version 1 NOVA backup", () => {
    const parsed = parseNovaBackup(JSON.stringify(backup));

    expect(parsed.version).toBe(2);
    expect(summarizeNovaBackup(parsed)).toEqual({
      exportedAt: backup.exportedAt,
      desktopItems: 0,
      readerBooks: 0,
      localSettings: 1,
    });
  });

  it("[defect-probing] rejects an invalid export date before the restore preview renders", () => {
    expect(() => parseNovaBackup(JSON.stringify({
      ...backup,
      exportedAt: "not-a-date",
    }))).toThrow("备份文件格式无效");
  });

  it("rejects legacy and non-NOVA localStorage keys", () => {
    expect(() => parseNovaBackup(JSON.stringify({
      ...backup,
      localStorage: { "nova-desktop-items": "[]" },
    }))).toThrow("备份文件格式无效");
    expect(() => parseNovaBackup(JSON.stringify({
      ...backup,
      localStorage: { token: "secret" },
    }))).toThrow("备份文件格式无效");
  });

  it("creates a version 2 backup from every storage provider", async () => {
    const desktopItem = {
      id: "note",
      type: "text" as const,
      name: "note.txt",
      content: "NOVA",
      parentId: null,
      createdAt: 1,
    };
    storageMocks.loadDesktopItems.mockResolvedValue([desktopItem]);
    localStorage.setItem("nova-settings", "{}");
    localStorage.setItem("unrelated", "keep");

    const result = await createNovaBackup();

    expect(result.version).toBe(2);
    expect(result.providers.desktop).toEqual([desktopItem]);
    expect(result.providers.reader).toEqual([]);
    expect(result.providers.settings).toEqual({
      localStorage: { "nova-settings": "{}" },
    });
    expect(result.providers.games).toEqual({ localStorage: {}, magicTower: [] });
  });

  it("restores NOVA data without deleting unrelated localStorage", async () => {
    localStorage.setItem("nova-settings", "old");
    localStorage.setItem("nova-stale", "remove");
    localStorage.setItem("unrelated", "keep");

    await restoreNovaBackup(parseNovaBackup(JSON.stringify(backup)));

    expect(storageMocks.replaceDesktopItems).toHaveBeenCalledWith([]);
    expect(storageMocks.replaceStoredBooks).toHaveBeenCalledWith([]);
    expect(localStorage.getItem("nova-settings")).toBe("{\"theme\":\"dark\"}");
    expect(localStorage.getItem("nova-stale")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
});
