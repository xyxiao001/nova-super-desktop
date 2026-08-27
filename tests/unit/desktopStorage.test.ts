import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopItem } from "../../app/desktopFiles";
import {
  createDesktopSyncQueue,
  loadDesktopItems,
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

  it("deletes removed records without rewriting retained objects", async () => {
    const first = item("first");
    const second = item("second");
    const sync = createDesktopSyncQueue([]);
    await sync.enqueue([first, second]);
    await sync.enqueue([second]);

    await expect(loadDesktopItems(createStorage())).resolves.toEqual([second]);
  });
});
