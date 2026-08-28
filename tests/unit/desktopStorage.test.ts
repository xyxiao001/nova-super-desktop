import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopItem } from "../../app/desktopFiles";
import {
  createDesktopSyncQueue,
  deleteDesktopItems,
  loadDesktopDirectory,
  loadDesktopFile,
  loadDesktopItems,
  loadDesktopWorkspace,
  replaceDesktopItems,
} from "../../app/desktopStorage";

const DATABASE_NAME = "nova-desktop";

const item = (id: string, content = ""): DesktopItem => ({
  id,
  type: "text",
  name: `${id}.txt`,
  content,
  parentId: null,
  createdAt: 1,
});

const createStorage = (legacy: string | null = null) => {
  const values = new Map<string, string>();
  if (legacy !== null) values.set("nova-desktop-items", legacy);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
};

afterEach(async () => {
  await deleteDB(DATABASE_NAME);
});

describe("desktopStorage", () => {
  it("stores metadata and Blob content in separate object stores", async () => {
    await replaceDesktopItems([
      item("root", "root body"),
      { ...item("child", "child body"), parentId: "folder" },
      { ...item("folder"), type: "folder", name: "folder", content: "" },
    ]);

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction(["items", "contents"], "readonly");
    const metadata = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = transaction.objectStore("items").get("root");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as Record<string, unknown>);
    });
    const content = await new Promise<{ content: Blob }>((resolve, reject) => {
      const request = transaction.objectStore("contents").get("root");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as { content: Blob });
    });

    expect(metadata).not.toHaveProperty("content");
    expect(content.content).toBeInstanceOf(Blob);
    expect(await content.content.text()).toBe("root body");
    database.close();
  });

  it("reads direct directory metadata and one complete file independently", async () => {
    const root = item("root", "root body");
    const folder = { ...item("folder"), type: "folder" as const, name: "folder", content: "" };
    const child = { ...item("child", "child body"), parentId: folder.id };
    await replaceDesktopItems([root, folder, child]);

    await expect(loadDesktopDirectory(null, createStorage())).resolves.toEqual([
      expect.objectContaining({ id: "folder" }),
      expect.objectContaining({ id: "root" }),
    ]);
    expect((await loadDesktopDirectory(null, createStorage())).every((entry) => !("content" in entry))).toBe(true);
    await expect(loadDesktopDirectory(folder.id, createStorage())).resolves.toEqual([
      expect.objectContaining({ id: "child" }),
    ]);
    await expect(loadDesktopFile(child.id, createStorage())).resolves.toEqual(child);
    await expect(loadDesktopWorkspace(createStorage())).resolves.toEqual(
      expect.arrayContaining([root, folder, child]),
    );
  });

  it("migrates version-one inline content into the Blob store", async () => {
    const legacy = item("inline", "inline body");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => request.result.createObjectStore("items", { keyPath: "id" });
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("items", "readwrite");
        transaction.objectStore("items").put(legacy);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });

    await expect(loadDesktopFile(legacy.id, createStorage())).resolves.toEqual(legacy);
    await expect(loadDesktopDirectory(null, createStorage())).resolves.toEqual([
      expect.not.objectContaining({ content: expect.anything() }),
    ]);
  });

  it("migrates legacy localStorage data once and removes the old key", async () => {
    const legacyItems = [item("legacy", "old")];
    const storage = createStorage(JSON.stringify(legacyItems));

    await expect(loadDesktopItems(storage)).resolves.toEqual(legacyItems);
    expect(storage.removeItem).toHaveBeenCalledWith("nova-desktop-items");
    await expect(loadDesktopItems(createStorage())).resolves.toEqual(legacyItems);
  });

  it("keeps malformed legacy data intact and rejects the load", async () => {
    const storage = createStorage("{invalid");

    await expect(loadDesktopItems(storage)).rejects.toBeInstanceOf(SyntaxError);
    expect(storage.removeItem).not.toHaveBeenCalled();
    await expect(loadDesktopItems(createStorage())).resolves.toEqual([]);
  });

  it("persists only the latest queued snapshot across rapid updates", async () => {
    const sync = createDesktopSyncQueue([]);
    const first = item("first", "v1");
    const second = item("second", "v1");

    const firstWrite = sync.enqueue([first]);
    const secondWrite = sync.enqueue([{ ...first, content: "v2" }, second]);
    await Promise.all([firstWrite, secondWrite]);

    await expect(loadDesktopItems(createStorage())).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "first", content: "v2" }),
        expect.objectContaining({ id: "second", content: "v1" }),
      ]),
    );
  });

  it("persists metadata and content changes without changing the other value", async () => {
    const original = item("separate", "v1");
    await replaceDesktopItems([original]);
    const sync = createDesktopSyncQueue([original]);

    const renamed = { ...original, name: "renamed.txt" };
    await sync.enqueue([renamed]);
    await expect(loadDesktopFile(original.id, createStorage())).resolves.toEqual(renamed);

    const edited = { ...renamed, content: "v2" };
    await sync.enqueue([edited]);
    await expect(loadDesktopFile(original.id, createStorage())).resolves.toEqual(edited);
  });

  it("deletes removed records without rewriting retained objects", async () => {
    const first = item("first");
    const second = item("second");
    const sync = createDesktopSyncQueue([]);
    await sync.enqueue([first, second]);
    await sync.enqueue([second]);

    await expect(loadDesktopItems(createStorage())).resolves.toEqual([second]);
  });

  it("deletes an explicit set of desktop records", async () => {
    await replaceDesktopItems([item("first"), item("second"), item("third")]);

    await deleteDesktopItems(["first", "third"]);

    await expect(loadDesktopItems(createStorage())).resolves.toEqual([item("second")]);
  });

  it("serializes a full restore after previously queued incremental writes", async () => {
    const sync = createDesktopSyncQueue([]);
    const queuedWrite = sync.enqueue([item("stale")]);
    const restoredItem = item("restored", "backup");
    const restore = replaceDesktopItems([restoredItem]);

    await Promise.all([queuedWrite, restore]);

    await expect(loadDesktopItems(createStorage())).resolves.toEqual([restoredItem]);
  });
});
