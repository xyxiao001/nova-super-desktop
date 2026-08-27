import { describe, expect, it } from "vitest";

import {
  descendantIds,
  duplicateDesktopItem,
  permanentlyDeleteDesktopItems,
  recycleBinItems,
  restoreDesktopItem,
  trashDesktopItems,
  visibleDesktopItems,
  moveDesktopItem,
  type DesktopItem,
} from "../../app/desktopFiles";

const items: DesktopItem[] = [
  { id: "folder-a", type: "folder", name: "项目", content: "", parentId: null, createdAt: 1 },
  { id: "folder-b", type: "folder", name: "资料", content: "", parentId: "folder-a", createdAt: 2 },
  { id: "text-a", type: "text", name: "说明.txt", content: "NOVA", parentId: "folder-b", createdAt: 3 },
  { id: "image-a", type: "image", name: "封面.png", content: "data:image/png;base64,AA==", parentId: null, createdAt: 4 },
];

describe("desktopFiles", () => {
  it("collects all descendants for recursive operations", () => {
    expect([...descendantIds(items, ["folder-a"])]).toEqual([
      "folder-a",
      "folder-b",
      "text-a",
    ]);
  });

  it("duplicates a folder tree with new ids and preserved relationships", () => {
    let id = 0;
    const result = duplicateDesktopItem(
      items,
      "folder-a",
      null,
      () => `copy-${++id}`,
      100,
    );
    const copies = result.slice(items.length);

    expect(copies).toEqual([
      expect.objectContaining({ id: "copy-1", name: "项目 - 副本", parentId: null, createdAt: 100 }),
      expect.objectContaining({ id: "copy-2", name: "资料", parentId: "copy-1", createdAt: 100 }),
      expect.objectContaining({ id: "copy-3", name: "说明.txt", parentId: "copy-2", createdAt: 100 }),
    ]);
  });

  it("increments duplicate names within the destination folder", () => {
    const withCopy = [
      ...items,
      { ...items[3], id: "image-copy", name: "封面 - 副本.png" },
    ];
    const result = duplicateDesktopItem(
      withCopy,
      "image-a",
      null,
      () => "copy-image",
      100,
    );

    expect(result.at(-1)?.name).toBe("封面 - 副本 (2).png");
  });

  it("does not restore trashed descendants when copying a folder", () => {
    const withTrashedChild = items.map((item) => (
      item.id === "folder-b" ? { ...item, deletedAt: 50 } : item
    ));
    let id = 0;
    const result = duplicateDesktopItem(
      withTrashedChild,
      "folder-a",
      null,
      () => `copy-${++id}`,
      100,
    );

    expect(result.slice(withTrashedChild.length)).toEqual([
      expect.objectContaining({ id: "copy-1", name: "项目 - 副本" }),
    ]);
  });

  it("moves files between folders", () => {
    const result = moveDesktopItem(items, "image-a", "folder-b");

    expect(result.moved).toBe(true);
    expect(result.items.find((item) => item.id === "image-a")?.parentId).toBe("folder-b");
  });

  it("rejects moving a folder into itself or its descendants", () => {
    expect(moveDesktopItem(items, "folder-a", "folder-a").moved).toBe(false);
    expect(moveDesktopItem(items, "folder-a", "folder-b").moved).toBe(false);
  });

  it("[defect-probing] rejects moving an item into a folder under a trashed ancestor", () => {
    const withTrashedAncestor = items.map((item) => (
      item.id === "folder-a" ? { ...item, deletedAt: 50 } : item
    ));

    expect(moveDesktopItem(withTrashedAncestor, "image-a", "folder-b").moved).toBe(false);
  });

  it("hides the complete subtree of a trashed folder", () => {
    const trashed = trashDesktopItems(items, ["folder-a"], 50);

    expect(visibleDesktopItems(trashed).map((item) => item.id)).toEqual(["image-a"]);
    expect(recycleBinItems(trashed).map((item) => item.id)).toEqual(["folder-a"]);
  });

  it("restores an item to its original visible parent", () => {
    const trashed = trashDesktopItems(items, ["text-a"], 50);
    const restored = restoreDesktopItem(trashed, "text-a");

    expect(restored.find((item) => item.id === "text-a")).toMatchObject({
      parentId: "folder-b",
      deletedAt: undefined,
    });
  });

  it("restores an item to the desktop when its parent tree remains trashed", () => {
    const trashed = trashDesktopItems(items, ["folder-a", "text-a"], 50);
    const restored = restoreDesktopItem(trashed, "text-a");

    expect(restored.find((item) => item.id === "text-a")).toMatchObject({
      parentId: null,
      deletedAt: undefined,
    });
  });

  it("permanently deletes a folder and its complete subtree", () => {
    const result = permanentlyDeleteDesktopItems(items, ["folder-a"]);

    expect([...result.removedIds]).toEqual(["folder-a", "folder-b", "text-a"]);
    expect(result.items.map((item) => item.id)).toEqual(["image-a"]);
  });
});
