import {
  visibleDesktopItems,
  type DesktopItem,
} from "./desktopFiles";

export const DESKTOP_OBJECT_STORAGE_KEY = "nova-desktop-objects";

export type DesktopObjectKind = "photo-card" | "note-card";

export type DesktopObject = {
  itemId: string;
  kind: DesktopObjectKind;
  x: number;
  y: number;
  createdAt: number;
};

export type DesktopObjectMap = Record<string, DesktopObject>;

export type VisibleDesktopObject = {
  object: DesktopObject;
  item: DesktopItem;
};

export const desktopObjectKindFor = (
  item: DesktopItem,
): DesktopObjectKind | null => (
  item.type === "image"
    ? "photo-card"
    : item.type === "text"
      ? "note-card"
      : null
);

export const isDesktopObjectCompatible = (
  object: DesktopObject,
  item: DesktopItem,
) => desktopObjectKindFor(item) === object.kind;

export const createDesktopObject = (
  objects: DesktopObjectMap,
  item: DesktopItem,
  position: { x: number; y: number },
  createdAt = Date.now(),
): DesktopObjectMap => {
  const kind = desktopObjectKindFor(item);
  if (!kind) return objects;
  return {
    ...objects,
    [item.id]: {
      itemId: item.id,
      kind,
      x: position.x,
      y: position.y,
      createdAt,
    },
  };
};

export const moveDesktopObject = (
  objects: DesktopObjectMap,
  itemId: string,
  position: { x: number; y: number },
): DesktopObjectMap => {
  const object = objects[itemId];
  if (!object) return objects;
  return {
    ...objects,
    [itemId]: { ...object, x: position.x, y: position.y },
  };
};

export const removeDesktopObjects = (
  objects: DesktopObjectMap,
  itemIds: Iterable<string>,
): DesktopObjectMap => {
  const removedIds = new Set(itemIds);
  if (![...removedIds].some((id) => objects[id])) return objects;
  return Object.fromEntries(
    Object.entries(objects).filter(([itemId]) => !removedIds.has(itemId)),
  );
};

export const visibleDesktopObjects = (
  objects: DesktopObjectMap,
  items: DesktopItem[],
): VisibleDesktopObject[] => {
  const visibleItems = new Map(
    visibleDesktopItems(items).map((item) => [item.id, item]),
  );
  return Object.values(objects)
    .map((object) => {
      const item = visibleItems.get(object.itemId);
      return item && isDesktopObjectCompatible(object, item)
        ? { object, item }
        : null;
    })
    .filter((entry): entry is VisibleDesktopObject => !!entry)
    .sort((left, right) => left.object.createdAt - right.object.createdAt);
};

const isDesktopObject = (value: unknown): value is DesktopObject => {
  if (!value || typeof value !== "object") return false;
  const object = value as Partial<DesktopObject>;
  return (
    typeof object.itemId === "string"
    && (object.kind === "photo-card" || object.kind === "note-card")
    && typeof object.x === "number"
    && Number.isFinite(object.x)
    && typeof object.y === "number"
    && Number.isFinite(object.y)
    && typeof object.createdAt === "number"
    && Number.isFinite(object.createdAt)
  );
};

export const parseDesktopObjects = (value: string | null): DesktopObjectMap => {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([itemId, object]) => (
          isDesktopObject(object) && object.itemId === itemId
        )),
    );
  } catch {
    return {};
  }
};

export const readDesktopObjects = (
  storage: Pick<Storage, "getItem"> = localStorage,
) => parseDesktopObjects(storage.getItem(DESKTOP_OBJECT_STORAGE_KEY));

export const saveDesktopObjects = (
  objects: DesktopObjectMap,
  storage: Pick<Storage, "setItem"> = localStorage,
) => storage.setItem(DESKTOP_OBJECT_STORAGE_KEY, JSON.stringify(objects));
