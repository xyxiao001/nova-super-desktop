import "fake-indexeddb/auto";
import { IDBKeyRange, indexedDB as fakeIndexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNovaBackup,
  parseNovaBackup,
  restoreNovaBackup,
} from "../../app/novaBackup";
import {
  STORAGE_PROVIDER_BY_ID,
  readMagicTowerRecords,
  replaceMagicTowerRecords,
  type GameStorageProviderData,
} from "../../app/storageProviders";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const deleteMagicTowerDatabase = () => new Promise<void>((resolve, reject) => {
  const request = fakeIndexedDB.deleteDatabase("nova-magic-tower");
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve();
});

const createLocalForageMagicTowerDatabase = () => new Promise<void>((resolve, reject) => {
  const request = fakeIndexedDB.open("nova-magic-tower", 2);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("humanbreak_saves");
    request.result.createObjectStore("local-forage-detect-blob-support");
  };
  request.onsuccess = () => {
    request.result.close();
    resolve();
  };
});

beforeEach(async () => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("indexedDB", fakeIndexedDB);
  vi.stubGlobal("IDBKeyRange", IDBKeyRange);
  await deleteMagicTowerDatabase();
});

afterEach(async () => {
  await deleteMagicTowerDatabase();
  vi.unstubAllGlobals();
});

describe("storage providers", () => {
  it("reads a Magic Tower database upgraded by localForage", async () => {
    await createLocalForageMagicTowerDatabase();
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = fakeIndexedDB.open("nova-magic-tower");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction("humanbreak_saves", "readwrite");
    transaction.objectStore("humanbreak_saves").put("saved", "save1");
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();

    await expect(readMagicTowerRecords()).resolves.toEqual([
      { key: "save1", value: "saved" },
    ]);
  });

  it("exports game localStorage and Magic Tower IndexedDB together", async () => {
    localStorage.setItem("nova-game-records", "{}");
    localStorage.setItem("HumanBreak_settings", "hard");
    localStorage.setItem("nova-reader-bookmarks", "[]");
    localStorage.setItem("unrelated", "keep");
    await replaceMagicTowerRecords([
      { key: "save1", value: "compressed-save" },
      { key: "autosave", value: { floorId: "MT1" } },
    ]);

    const data = await STORAGE_PROVIDER_BY_ID.games.exportData() as GameStorageProviderData;

    expect(data.localStorage).toEqual({
      "nova-game-records": "{}",
      "HumanBreak_settings": "hard",
    });
    expect(data.magicTower).toEqual([
      { key: "autosave", value: { floorId: "MT1" } },
      { key: "save1", value: "compressed-save" },
    ]);
  });

  it("clears only game data across localStorage and IndexedDB", async () => {
    localStorage.setItem("nova-game-records", "{}");
    localStorage.setItem("HumanBreak_settings", "hard");
    localStorage.setItem("nova-reader-bookmarks", "[]");
    await replaceMagicTowerRecords([{ key: "save1", value: "saved" }]);

    await STORAGE_PROVIDER_BY_ID.games.clear();

    expect(localStorage.getItem("nova-game-records")).toBeNull();
    expect(localStorage.getItem("HumanBreak_settings")).toBeNull();
    expect(localStorage.getItem("nova-reader-bookmarks")).toBe("[]");
    expect(await readMagicTowerRecords()).toEqual([]);
  });

  it("replaces game data from a validated provider backup", async () => {
    localStorage.setItem("nova-game-records", "old");
    await replaceMagicTowerRecords([{ key: "old", value: "old-save" }]);
    const backup: GameStorageProviderData = {
      localStorage: {
        "nova-game-records": "new",
        "HumanBreak_settings": "normal",
      },
      magicTower: [{ key: "save2", value: "new-save" }],
    };

    expect(STORAGE_PROVIDER_BY_ID.games.validateData(backup)).toBe(true);
    await STORAGE_PROVIDER_BY_ID.games.restoreData(backup);

    expect(localStorage.getItem("nova-game-records")).toBe("new");
    expect(localStorage.getItem("HumanBreak_settings")).toBe("normal");
    expect(await readMagicTowerRecords()).toEqual([{ key: "save2", value: "new-save" }]);
  });

  it("round-trips Magic Tower data through a version 2 NOVA backup", async () => {
    localStorage.setItem("HumanBreak_settings", "hard");
    await replaceMagicTowerRecords([{ key: "save1", value: "complete-save" }]);

    const backup = await createNovaBackup();
    expect(backup.version).toBe(2);
    expect(backup.providers.games).toEqual({
      localStorage: { "HumanBreak_settings": "hard" },
      magicTower: [{ key: "save1", value: "complete-save" }],
    });

    await STORAGE_PROVIDER_BY_ID.games.clear();
    await restoreNovaBackup(parseNovaBackup(JSON.stringify(backup)));

    expect(localStorage.getItem("HumanBreak_settings")).toBe("hard");
    expect(await readMagicTowerRecords()).toEqual([{ key: "save1", value: "complete-save" }]);
  });

  it("rejects keys that do not belong to the provider", () => {
    expect(STORAGE_PROVIDER_BY_ID.games.validateData({
      localStorage: { token: "secret" },
      magicTower: [],
    })).toBe(false);
    expect(STORAGE_PROVIDER_BY_ID.settings.validateData({
      localStorage: { "nova-game-records": "{}" },
    })).toBe(false);
  });
});
