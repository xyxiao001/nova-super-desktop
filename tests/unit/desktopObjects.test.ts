import { describe, expect, it } from "vitest";

import {
  DESKTOP_OBJECT_STORAGE_KEY,
  DESKTOP_OBJECT_THEMES,
  clampDesktopObjectPosition,
  createDesktopObject,
  desktopObjectSize,
  moveDesktopObject,
  parseDesktopObjects,
  readDesktopObjects,
  removeDesktopObjects,
  resizeDesktopObject,
  saveDesktopObjects,
  setDesktopObjectTheme,
  visibleDesktopObjects,
  type DesktopObjectMap,
} from "../../app/desktopObjects";
import type { DesktopItem } from "../../app/desktopFiles";

const image: DesktopItem = {
  id: "image-1",
  type: "image",
  name: "海边.png",
  content: "data:image/png;base64,image",
  parentId: null,
  createdAt: 1,
};

const note: DesktopItem = {
  id: "note-1",
  type: "text",
  name: "摘录.txt",
  content: "保存在原始文稿中的内容",
  parentId: null,
  createdAt: 2,
};

const folder: DesktopItem = {
  id: "folder-1",
  type: "folder",
  name: "收藏",
  content: "",
  parentId: null,
  createdAt: 3,
};

describe("desktop creative objects", () => {
  it("keeps persisted positions inside the current desktop bounds", () => {
    expect(clampDesktopObjectPosition(
      { x: 1200, y: 900 },
      { width: 800, height: 600 },
      { width: 188, height: 174 },
    )).toEqual({ x: 612, y: 426 });
    expect(clampDesktopObjectPosition(
      { x: -20, y: -10 },
      { width: 800, height: 600 },
      { width: 188, height: 174 },
    )).toEqual({ x: 0, y: 0 });
  });

  it("creates one typed presentation record without copying file content", () => {
    const photoObjects = createDesktopObject({}, image, { x: 12, y: 24 }, 100);
    const objects = createDesktopObject(photoObjects, note, { x: 40, y: 60 }, 101);

    expect(objects).toEqual({
      "image-1": {
        itemId: "image-1",
        kind: "photo-card",
        x: 12,
        y: 24,
        createdAt: 100,
      },
      "note-1": {
        itemId: "note-1",
        kind: "note-card",
        x: 40,
        y: 60,
        createdAt: 101,
      },
    });
    expect(JSON.stringify(objects)).not.toContain(image.content);
    expect(createDesktopObject(objects, folder, { x: 0, y: 0 }, 102)).toBe(objects);
  });

  it("updates only the object coordinates and removes records by source id", () => {
    const objects = createDesktopObject({}, image, { x: 12, y: 24 }, 100);
    const moved = moveDesktopObject(objects, image.id, { x: 90, y: 140 });

    expect(moved[image.id]).toEqual({
      ...objects[image.id],
      x: 90,
      y: 140,
    });
    expect(removeDesktopObjects(moved, new Set([image.id]))).toEqual({});
    expect(removeDesktopObjects(moved, ["missing"])).toBe(moved);
  });

  it("uses default card sizes until a custom size is stored", () => {
    const objects = createDesktopObject({}, image, { x: 12, y: 24 }, 100);
    expect(desktopObjectSize(objects[image.id])).toEqual({ width: 188, height: 174 });

    const resized = resizeDesktopObject(objects, image.id, { width: 320, height: 240 });
    expect(desktopObjectSize(resized[image.id])).toEqual({ width: 320, height: 240 });
    expect(resized[image.id]).toMatchObject({ x: 12, y: 24, width: 320, height: 240 });
  });

  it("changes each card theme independently without changing geometry or source files", () => {
    const objects = createDesktopObject(
      resizeDesktopObject(createDesktopObject({}, image, { x: 12, y: 24 }, 100), image.id, { width: 320, height: 240 }),
      note,
      { x: 400, y: 60 },
      101,
    );
    const themed = setDesktopObjectTheme(setDesktopObjectTheme(objects, note.id, "midnight"), image.id, "film");

    expect(themed[note.id]).toEqual({ ...objects[note.id], theme: "midnight" });
    expect(themed[image.id]).toEqual({ ...objects[image.id], theme: "film" });
    expect(objects[note.id].theme).toBeUndefined();
    expect(visibleDesktopObjects(themed, [image, note]).map(({ item }) => item)).toEqual([image, note]);
    expect(parseDesktopObjects(JSON.stringify(themed))).toEqual(themed);
  });

  it("persists every offered theme and can return to the original appearance", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const objects = createDesktopObject(createDesktopObject({}, image, { x: 12, y: 24 }, 100), note, { x: 220, y: 24 }, 101);
    for (const item of [image, note]) {
      for (const { value } of DESKTOP_OBJECT_THEMES[objects[item.id].kind]) {
        saveDesktopObjects(setDesktopObjectTheme(objects, item.id, value), storage);
        expect(readDesktopObjects(storage)[item.id].theme).toBe(value);
      }
      const selectedTheme = DESKTOP_OBJECT_THEMES[objects[item.id].kind][1].value;
      const reset = setDesktopObjectTheme(setDesktopObjectTheme(objects, item.id, selectedTheme), item.id, undefined);
      saveDesktopObjects(reset, storage);
      expect(readDesktopObjects(storage)).toEqual(objects);
    }
  });

  it("keeps moved files visible, hides recycled files, and reads current content", () => {
    const objects = createDesktopObject(
      createDesktopObject({}, image, { x: 12, y: 24 }, 100),
      note,
      { x: 40, y: 60 },
      101,
    );
    const movedImage = { ...image, parentId: folder.id, content: "updated-image" };

    expect(visibleDesktopObjects(objects, [movedImage, note, folder])).toEqual([
      { object: objects[image.id], item: movedImage },
      { object: objects[note.id], item: note },
    ]);
    expect(visibleDesktopObjects(objects, [
      { ...movedImage, deletedAt: 200 },
      note,
      folder,
    ]).map((entry) => entry.item.id)).toEqual([note.id]);
    expect(visibleDesktopObjects(objects, [
      movedImage,
      note,
      { ...folder, deletedAt: 200 },
    ]).map((entry) => entry.item.id)).toEqual([note.id]);
  });

  it("ignores malformed or incompatible persisted records", () => {
    const objects = parseDesktopObjects(JSON.stringify({
      "image-1": {
        itemId: "image-1",
        kind: "photo-card",
        x: 1,
        y: 2,
        createdAt: 3,
      },
      mismatchedKey: {
        itemId: "other",
        kind: "note-card",
        x: 1,
        y: 2,
        createdAt: 3,
      },
      invalid: { itemId: "invalid", kind: "clock", x: 1, y: 2, createdAt: 3 },
    }));

    expect(Object.keys(objects)).toEqual(["image-1"]);
    expect(parseDesktopObjects("not json")).toEqual({});
    expect(visibleDesktopObjects(objects, [{ ...image, type: "text" }])).toEqual([]);
  });

  it("reads and writes the dedicated local storage key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const objects: DesktopObjectMap = resizeDesktopObject(
      createDesktopObject({}, image, { x: 12, y: 24 }, 100),
      image.id,
      { width: 320, height: 240 },
    );

    saveDesktopObjects(objects, storage);

    expect(values.has(DESKTOP_OBJECT_STORAGE_KEY)).toBe(true);
    expect(readDesktopObjects(storage)).toEqual(objects);
  });
});
