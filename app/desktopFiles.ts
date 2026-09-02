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

export type FileOperationMode = "copy" | "move";
export type FileConflictStrategy = "cancel" | "keep-both" | "replace";
export type FileClipboard = { mode: FileOperationMode; ids: string[] };
export type FileOperationConflict = {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  self: boolean;
};
export type FileOperationResult = {
  items: DesktopItem[];
  changed: boolean;
  resultIds: string[];
  removedIds: Set<string>;
};

export const NOVA_FILE_DRAG_TYPE = "application/x-nova-desktop-items";

export const hasDesktopFileDrag = (
  dataTransfer: Pick<DataTransfer, "types">,
) => Array.from(dataTransfer.types).includes(NOVA_FILE_DRAG_TYPE);

export function readDesktopFileDragIds(
  dataTransfer: Pick<DataTransfer, "getData">,
) {
  try {
    const value = JSON.parse(dataTransfer.getData(NOVA_FILE_DRAG_TYPE));
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeDesktopFileDragIds(
  dataTransfer: Pick<DataTransfer, "effectAllowed" | "setData">,
  ids: string[],
) {
  dataTransfer.effectAllowed = "copyMove";
  dataTransfer.setData(NOVA_FILE_DRAG_TYPE, JSON.stringify(ids));
  dataTransfer.setData("text/plain", ids.join(","));
}

export const desktopFileDragMode = ({
  altKey,
  ctrlKey,
  metaKey,
}: Pick<DragEvent, "altKey" | "ctrlKey" | "metaKey">): FileOperationMode => (
  altKey || ctrlKey || metaKey ? "copy" : "move"
);

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

export function replaceDesktopImage(
  items: DesktopItem[],
  id: string,
  content: string,
) {
  const source = items.find((item) => (
    item.id === id
    && item.type === "image"
    && isDesktopItemVisible(items, item)
  ));
  if (!source || source.content === content) {
    return { items, changed: false, item: source ?? null };
  }
  return {
    items: items.map((item) => (
      item.id === id ? { ...item, content } : item
    )),
    changed: true,
    item: source,
  };
}

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

const restoredName = (
  items: DesktopItem[],
  source: DesktopItem,
  parentId: string | null,
) => {
  const siblingNames = new Set(
    visibleDesktopItems(items)
      .filter((item) => item.parentId === parentId)
      .map((item) => item.name),
  );
  if (!siblingNames.has(source.name)) return source.name;
  const dot = source.type === "folder" ? -1 : source.name.lastIndexOf(".");
  const base = dot > 0 ? source.name.slice(0, dot) : source.name;
  const extension = dot > 0 ? source.name.slice(dot) : "";
  let index = 1;
  let name = `${base} (已还原)${extension}`;
  while (siblingNames.has(name)) {
    index += 1;
    name = `${base} (已还原 ${index})${extension}`;
  }
  return name;
};

export const restoreDesktopItems = (items: DesktopItem[], ids: string[]) => {
  let next = items;
  const resultIds: string[] = [];
  for (const id of ids) {
    const source = next.find((item) => item.id === id && item.deletedAt);
    if (!source) continue;
    const parent = source.parentId
      ? next.find((item) => item.id === source.parentId)
      : null;
    const parentId = parent && isDesktopItemVisible(next, parent) ? parent.id : null;
    const name = restoredName(next, source, parentId);
    next = next.map((item) => (
      item.id === id ? { ...item, name, parentId, deletedAt: undefined } : item
    ));
    resultIds.push(id);
  }
  return { items: next, resultIds };
};

export const restoreDesktopItem = (items: DesktopItem[], id: string) => {
  return restoreDesktopItems(items, [id]).items;
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

export const topLevelDesktopItemIds = (items: DesktopItem[], ids: string[]) => {
  const visibleIds = new Set(visibleDesktopItems(items).map((item) => item.id));
  const selected = new Set(ids.filter((id) => visibleIds.has(id)));
  return [...selected].filter((id) => {
    let parentId = items.find((item) => item.id === id)?.parentId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      if (selected.has(parentId)) return false;
      visited.add(parentId);
      parentId = items.find((item) => item.id === parentId)?.parentId;
    }
    return true;
  });
};

const sameFileName = (left: string, right: string) => (
  left.localeCompare(right, "zh-CN", { sensitivity: "accent" }) === 0
);

const fileNameParts = (item: DesktopItem) => {
  const dot = item.type === "folder" ? -1 : item.name.lastIndexOf(".");
  return {
    base: dot > 0 ? item.name.slice(0, dot) : item.name,
    extension: dot > 0 ? item.name.slice(dot) : "",
  };
};

const availableFileName = (
  item: DesktopItem,
  usedNames: string[],
  duplicate = false,
) => {
  if (!usedNames.some((name) => sameFileName(name, item.name))) return item.name;
  const { base, extension } = fileNameParts(item);
  let index = duplicate ? 1 : 2;
  let name = duplicate
    ? `${base} - 副本${extension}`
    : `${base} (${index})${extension}`;
  while (usedNames.some((entry) => sameFileName(entry, name))) {
    index += 1;
    name = duplicate
      ? `${base} - 副本 (${index})${extension}`
      : `${base} (${index})${extension}`;
  }
  return name;
};

const operationRoots = (
  items: DesktopItem[],
  ids: string[],
  parentId: string | null,
  mode: FileOperationMode,
) => {
  const liveItems = visibleDesktopItems(items);
  const roots = topLevelDesktopItemIds(items, ids)
    .map((id) => liveItems.find((item) => item.id === id))
    .filter((item): item is DesktopItem => !!item);
  const target = parentId
    ? liveItems.find((item) => item.id === parentId && item.type === "folder")
    : null;
  if (parentId && !target) return [];
  if (roots.some((item) => (
    item.type === "folder"
    && parentId !== null
    && descendantIds(items, [item.id]).has(parentId)
  ))) return [];
  return mode === "move"
    ? roots.filter((item) => item.parentId !== parentId)
    : roots;
};

export function desktopFileOperationConflicts(
  items: DesktopItem[],
  ids: string[],
  parentId: string | null,
  mode: FileOperationMode,
) {
  const roots = operationRoots(items, ids, parentId, mode);
  const siblings = visibleDesktopItems(items).filter((item) => item.parentId === parentId);
  return roots.flatMap<FileOperationConflict>((source) => (
    siblings.filter((item) => (
      sameFileName(item.name, source.name)
      && (mode === "copy" || item.id !== source.id)
    )).map((target) => ({
      sourceId: source.id,
      sourceName: source.name,
      targetId: target.id,
      targetName: target.name,
      self: source.id === target.id,
    }))
  ));
}

export function applyDesktopFileOperation(
  items: DesktopItem[],
  ids: string[],
  parentId: string | null,
  mode: FileOperationMode,
  strategy: FileConflictStrategy,
  createId: () => string = () => crypto.randomUUID(),
  now = Date.now(),
): FileOperationResult {
  const roots = operationRoots(items, ids, parentId, mode);
  if (!roots.length) {
    return { items, changed: false, resultIds: [], removedIds: new Set() };
  }
  const rootIds = new Set(roots.map((item) => item.id));
  const conflicts = desktopFileOperationConflicts(items, ids, parentId, mode);
  const externalConflicts = conflicts.filter((conflict) => !rootIds.has(conflict.targetId));
  if (strategy === "cancel" && externalConflicts.length) {
    return { items, changed: false, resultIds: [], removedIds: new Set() };
  }

  const removedIds = strategy === "replace"
    ? descendantIds(items, externalConflicts.map((conflict) => conflict.targetId))
    : new Set<string>();
  const retained = items.filter((item) => !removedIds.has(item.id));
  const destinationNames = visibleDesktopItems(retained)
    .filter((item) => (
      item.parentId === parentId
      && (mode === "copy" || !rootIds.has(item.id))
    ))
    .map((item) => item.name);

  if (mode === "move") {
    const names = [...destinationNames];
    const movedItems = retained.map((item) => {
      if (!rootIds.has(item.id)) return item;
      const name = availableFileName(item, names);
      names.push(name);
      return { ...item, name, parentId };
    });
    return {
      items: movedItems,
      changed: true,
      resultIds: [...rootIds],
      removedIds,
    };
  }

  const names = [...destinationNames];
  const copies: DesktopItem[] = [];
  const resultIds: string[] = [];
  for (const root of roots) {
    const copiedIds = descendantIds(items, [root.id]);
    const idMap = new Map([...copiedIds].map((id) => [id, createId()]));
    const duplicateInPlace = root.parentId === parentId;
    const rootName = availableFileName(
      root,
      names,
      duplicateInPlace,
    );
    names.push(rootName);
    resultIds.push(idMap.get(root.id)!);
    copies.push(...items
      .filter((item) => copiedIds.has(item.id) && isDesktopItemVisible(items, item))
      .map((item) => ({
        ...item,
        id: idMap.get(item.id)!,
        name: item.id === root.id ? rootName : item.name,
        parentId: item.id === root.id
          ? parentId
          : idMap.get(item.parentId!) ?? parentId,
        createdAt: now,
        lastOpenedAt: undefined,
        deletedAt: undefined,
      })));
  }
  return {
    items: [...retained, ...copies],
    changed: copies.length > 0,
    resultIds,
    removedIds,
  };
}
