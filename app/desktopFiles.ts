export type DesktopItem = {
  id: string;
  type: "folder" | "text" | "image";
  name: string;
  content: string;
  parentId: string | null;
  createdAt: number;
  lastOpenedAt?: number;
  deletedAt?: number;
};

export const descendantIds = (items: DesktopItem[], roots: string[]) => {
  const ids = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        changed = true;
      }
    }
  }
  return ids;
};

const hasTrashedAncestor = (
  itemsById: Map<string, DesktopItem>,
  item: DesktopItem,
) => {
  const visited = new Set<string>();
  let parentId = item.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = itemsById.get(parentId);
    if (!parent) return false;
    if (parent.deletedAt) return true;
    parentId = parent.parentId;
  }
  return false;
};

export const isDesktopItemVisible = (items: DesktopItem[], item: DesktopItem) => (
  !item.deletedAt && !hasTrashedAncestor(new Map(items.map((entry) => [entry.id, entry])), item)
);

export const visibleDesktopItems = (items: DesktopItem[]) => {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return items.filter((item) => !item.deletedAt && !hasTrashedAncestor(itemsById, item));
};

export const recycleBinItems = (items: DesktopItem[]) => {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return items.filter((item) => item.deletedAt && !hasTrashedAncestor(itemsById, item));
};

export const trashDesktopItems = (
  items: DesktopItem[],
  ids: string[],
  deletedAt = Date.now(),
) => {
  const selected = new Set(ids);
  return items.map((item) => (
    selected.has(item.id) ? { ...item, deletedAt } : item
  ));
};

export const restoreDesktopItem = (items: DesktopItem[], id: string) => {
  const source = items.find((item) => item.id === id && item.deletedAt);
  if (!source) return items;
  const parent = source.parentId
    ? items.find((item) => item.id === source.parentId)
    : null;
  const parentId = parent && isDesktopItemVisible(items, parent) ? parent.id : null;
  return items.map((item) => (
    item.id === id ? { ...item, parentId, deletedAt: undefined } : item
  ));
};

export const permanentlyDeleteDesktopItems = (items: DesktopItem[], ids: string[]) => {
  const removedIds = descendantIds(items, ids);
  return {
    items: items.filter((item) => !removedIds.has(item.id)),
    removedIds,
  };
};

const copyName = (items: DesktopItem[], item: DesktopItem, parentId: string | null) => {
  const dot = item.type === "folder" ? -1 : item.name.lastIndexOf(".");
  const base = dot > 0 ? item.name.slice(0, dot) : item.name;
  const extension = dot > 0 ? item.name.slice(dot) : "";
  const siblings = new Set(
    visibleDesktopItems(items)
      .filter((entry) => entry.parentId === parentId)
      .map((entry) => entry.name),
  );
  let index = 1;
  let name = `${base} - 副本${extension}`;
  while (siblings.has(name)) {
    index += 1;
    name = `${base} - 副本 (${index})${extension}`;
  }
  return name;
};

export function duplicateDesktopItem(
  items: DesktopItem[],
  sourceId: string,
  parentId: string | null,
  createId: () => string = () => crypto.randomUUID(),
  now = Date.now(),
) {
  const visibleItems = visibleDesktopItems(items);
  const source = visibleItems.find((item) => item.id === sourceId);
  const target = parentId
    ? visibleItems.find((item) => item.id === parentId && item.type === "folder")
    : null;
  if (!source || (parentId && !target)) return items;
  const copiedIds = new Set([sourceId]);
  const visibleIds = new Set(visibleItems.map((item) => item.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (
        visibleIds.has(item.id)
        && item.parentId
        && copiedIds.has(item.parentId)
        && !copiedIds.has(item.id)
      ) {
        copiedIds.add(item.id);
        changed = true;
      }
    }
  }
  const idMap = new Map([...copiedIds].map((id) => [id, createId()]));
  const copies = items
    .filter((item) => copiedIds.has(item.id))
    .map((item) => ({
      ...item,
      id: idMap.get(item.id)!,
      name: item.id === sourceId ? copyName(items, item, parentId) : item.name,
      parentId: item.id === sourceId ? parentId : idMap.get(item.parentId!) ?? parentId,
      createdAt: now,
      lastOpenedAt: undefined,
      deletedAt: undefined,
    }));
  return [...items, ...copies];
}

export function moveDesktopItem(
  items: DesktopItem[],
  sourceId: string,
  parentId: string | null,
) {
  const visibleItems = visibleDesktopItems(items);
  const source = visibleItems.find((item) => item.id === sourceId);
  const target = parentId
    ? visibleItems.find((item) => item.id === parentId && item.type === "folder")
    : null;
  if (!source || (parentId && !target) || source.parentId === parentId) {
    return { items, moved: false };
  }
  if (source.type === "folder" && parentId && descendantIds(items, [sourceId]).has(parentId)) {
    return { items, moved: false };
  }
  return {
    items: items.map((item) => item.id === sourceId ? { ...item, parentId } : item),
    moved: true,
  };
}
