import { describe, expect, it } from "vitest";

import {
  applyDesktopFileOperation,
  desktopFileDragMode,
  desktopFileOperationConflicts,
  descendantIds,
  duplicateDesktopItem,
  hasDesktopFileDrag,
  permanentlyDeleteDesktopItems,
  readDesktopFileDragIds,
  recycleBinItems,
  replaceDesktopImage,
  restoreDesktopItem,
  restoreDesktopItems,
  trashDesktopItems,
  topLevelDesktopItemIds,
  visibleDesktopItems,
  writeDesktopFileDragIds,
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
  it("round-trips the shared desktop drag payload", () => {
    const values = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none" as DataTransfer["effectAllowed"],
      types: [] as string[],
      getData: (type: string) => values.get(type) ?? "",
      setData(type: string, value: string) {
        values.set(type, value);
        if (!this.types.includes(type)) this.types.push(type);
      },
    };

    writeDesktopFileDragIds(dataTransfer, ["folder-a", "image-a"]);

    expect(dataTransfer.effectAllowed).toBe("copyMove");
    expect(hasDesktopFileDrag(dataTransfer)).toBe(true);
    expect(readDesktopFileDragIds(dataTransfer)).toEqual(["folder-a", "image-a"]);
    expect(values.get("text/plain")).toBe("folder-a,image-a");
  });

  it("uses a copy operation for every supported drag modifier", () => {
    expect(desktopFileDragMode({ altKey: false, ctrlKey: false, metaKey: false }))
      .toBe("move");
    expect(desktopFileDragMode({ altKey: true, ctrlKey: false, metaKey: false }))
      .toBe("copy");
    expect(desktopFileDragMode({ altKey: false, ctrlKey: true, metaKey: false }))
      .toBe("copy");
    expect(desktopFileDragMode({ altKey: false, ctrlKey: false, metaKey: true }))
      .toBe("copy");
  });

  it("ignores malformed or non-array desktop drag payloads", () => {
    expect(readDesktopFileDragIds({ getData: () => "{" })).toEqual([]);
    expect(readDesktopFileDragIds({ getData: () => JSON.stringify({ id: "folder-a" }) }))
      .toEqual([]);
    expect(readDesktopFileDragIds({
      getData: () => JSON.stringify(["folder-a", 1, null, "image-a"]),
    })).toEqual(["folder-a", "image-a"]);
  });

  it("collects all descendants for recursive operations", () => {
    expect([...descendantIds(items, ["folder-a"])]).toEqual([
      "folder-a",
      "folder-b",
      "text-a",
    ]);
  });

  it("replaces only a visible image", () => {
    const result = replaceDesktopImage(items, "image-a", "updated");

    expect(result.changed).toBe(true);
    expect(result.item?.name).toBe("封面.png");
    expect(result.items.find((item) => item.id === "image-a")?.content).toBe("updated");
    expect(replaceDesktopImage(items, "text-a", "updated").changed).toBe(false);
    expect(replaceDesktopImage(
      items.map((item) => item.id === "image-a" ? { ...item, deletedAt: 5 } : item),
      "image-a",
      "updated",
    ).changed).toBe(false);
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

  it("restores multiple items without overwriting visible name conflicts", () => {
    const trashed: DesktopItem[] = [
      ...items,
      { id: "deleted-1", type: "text", name: "说明.txt", content: "old", parentId: null, createdAt: 5, deletedAt: 10 },
      { id: "deleted-2", type: "text", name: "说明.txt", content: "older", parentId: null, createdAt: 6, deletedAt: 11 },
      { id: "visible", type: "text", name: "说明.txt", content: "current", parentId: null, createdAt: 7 },
    ];
    const result = restoreDesktopItems(trashed, ["deleted-1", "deleted-2"]);

    expect(result.resultIds).toEqual(["deleted-1", "deleted-2"]);
    expect(result.items.find((item) => item.id === "deleted-1")?.name).toBe("说明 (已还原).txt");
    expect(result.items.find((item) => item.id === "deleted-2")?.name).toBe("说明 (已还原 2).txt");
  });

  it("permanently deletes a folder and its complete subtree", () => {
    const result = permanentlyDeleteDesktopItems(items, ["folder-a"]);

    expect([...result.removedIds]).toEqual(["folder-a", "folder-b", "text-a"]);
    expect(result.items.map((item) => item.id)).toEqual(["image-a"]);
  });

  it("normalizes a multi-selection to top-level roots", () => {
    expect(topLevelDesktopItemIds(items, ["folder-a", "folder-b", "text-a", "image-a"]))
      .toEqual(["folder-a", "image-a"]);
  });

  it("copies multiple roots and preserves a folder subtree", () => {
    let id = 0;
    const result = applyDesktopFileOperation(
      items,
      ["folder-b", "image-a"],
      null,
      "copy",
      "keep-both",
      () => `new-${++id}`,
      100,
    );

    expect(result.changed).toBe(true);
    expect(result.resultIds).toEqual(["new-1", "new-3"]);
    expect(result.items.slice(items.length)).toEqual([
      expect.objectContaining({ id: "new-1", name: "资料", parentId: null }),
      expect.objectContaining({ id: "new-2", name: "说明.txt", parentId: "new-1" }),
      expect.objectContaining({ id: "new-3", name: "封面 - 副本.png", parentId: null }),
    ]);
  });

  it("detects external name conflicts and supports cancelling the operation", () => {
    const conflicting: DesktopItem[] = [
      ...items,
      { id: "target", type: "text", name: "说明.txt", content: "旧", parentId: null, createdAt: 5 },
    ];

    expect(desktopFileOperationConflicts(
      conflicting,
      ["text-a"],
      null,
      "move",
    )).toEqual([
      expect.objectContaining({ sourceId: "text-a", targetId: "target", self: false }),
    ]);
    expect(applyDesktopFileOperation(
      conflicting,
      ["text-a"],
      null,
      "move",
      "cancel",
    ).changed).toBe(false);
  });

  it("keeps both files by assigning an available destination name", () => {
    const conflicting: DesktopItem[] = [
      ...items,
      { id: "target", type: "text", name: "说明.txt", content: "旧", parentId: null, createdAt: 5 },
    ];
    const result = applyDesktopFileOperation(
      conflicting,
      ["text-a"],
      null,
      "move",
      "keep-both",
    );

    expect(result.items.find((item) => item.id === "text-a")).toMatchObject({
      name: "说明 (2).txt",
      parentId: null,
    });
  });

  it("replaces all conflicting target trees during a move", () => {
    const conflicting: DesktopItem[] = [
      ...items,
      { id: "target-1", type: "folder", name: "资料", content: "", parentId: null, createdAt: 5 },
      { id: "target-2", type: "folder", name: "资料", content: "", parentId: null, createdAt: 6 },
      { id: "target-child", type: "text", name: "旧.txt", content: "", parentId: "target-1", createdAt: 7 },
    ];
    const result = applyDesktopFileOperation(
      conflicting,
      ["folder-b"],
      null,
      "move",
      "replace",
    );

    expect([...result.removedIds]).toEqual(["target-1", "target-2", "target-child"]);
    expect(result.items.some((item) => item.id.startsWith("target"))).toBe(false);
    expect(result.items.find((item) => item.id === "folder-b")).toMatchObject({
      name: "资料",
      parentId: null,
    });
  });

  it("copies in place with a stable copy suffix", () => {
    const result = applyDesktopFileOperation(
      items,
      ["image-a"],
      null,
      "copy",
      "keep-both",
      () => "image-copy",
      100,
    );

    expect(result.items.at(-1)).toMatchObject({
      id: "image-copy",
      name: "封面 - 副本.png",
    });
  });
});
