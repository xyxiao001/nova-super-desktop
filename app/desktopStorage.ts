import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";

import type { DesktopItem } from "./desktopFiles";

const DATABASE_NAME = "nova-desktop";
const DATABASE_VERSION = 2;
const LEGACY_STORAGE_KEY = "nova-desktop-items";
const ROOT_PARENT_KEY = "";

export type DesktopItemMetadata = Omit<DesktopItem, "content">;

type StoredDesktopMetadata = DesktopItemMetadata & { parentKey: string };
type StoredDesktopContent = { id: string; content: Blob };

interface NovaDesktopDatabase extends DBSchema {
  items: {
    key: string;
    value: StoredDesktopMetadata;
    indexes: { "by-parent": string };
  };
  contents: {
    key: string;
    value: StoredDesktopContent;
  };
}

type LegacyStorage = Pick<Storage, "getItem" | "removeItem">;
type DesktopTransaction = IDBPTransaction<NovaDesktopDatabase, ["items", "contents"], "readwrite">;
let databaseWriteQueue: Promise<void> = Promise.resolve();

const serializeDesktopWrite = (write: () => Promise<void>) => {
  const operation = databaseWriteQueue.catch(() => undefined).then(write);
  databaseWriteQueue = operation.catch(() => undefined);
  return operation;
};

const metadataRecord = ({ content: _content, ...item }: DesktopItem): StoredDesktopMetadata => ({
  ...item,
  parentKey: item.parentId ?? ROOT_PARENT_KEY,
});

const publicMetadata = ({ parentKey: _parentKey, ...item }: StoredDesktopMetadata): DesktopItemMetadata => item;

const contentRecord = (item: DesktopItem): StoredDesktopContent => ({
  id: item.id,
  content: new Blob([item.content], {
    type: item.type === "image" ? "application/x-nova-image-data-url" : "text/plain;charset=utf-8",
  }),
});

const putDesktopItem = (transaction: DesktopTransaction, item: DesktopItem) => {
  const writes: Promise<unknown>[] = [transaction.objectStore("items").put(metadataRecord(item))];
  if (item.type === "folder") writes.push(transaction.objectStore("contents").delete(item.id));
  else writes.push(transaction.objectStore("contents").put(contentRecord(item)));
  return Promise.all(writes);
};

const openDesktopDatabase = () => openDB<NovaDesktopDatabase>(DATABASE_NAME, DATABASE_VERSION, {
  upgrade(database, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      const items = database.createObjectStore("items", { keyPath: "id" });
      items.createIndex("by-parent", "parentKey");
      database.createObjectStore("contents", { keyPath: "id" });
      return;
    }

    if (oldVersion < 2) {
      const items = transaction.objectStore("items");
      items.createIndex("by-parent", "parentKey");
      const contents = database.createObjectStore("contents", { keyPath: "id" });
      void items.getAll().then((legacyItems) => Promise.all(legacyItems.map((legacy) => {
        const item = legacy as unknown as DesktopItem;
        const writes: Promise<unknown>[] = [items.put(metadataRecord(item))];
        if (item.type !== "folder") writes.push(contents.put(contentRecord(item)));
        return Promise.all(writes);
      })));
    }
  },
});

const migrateLegacyStorage = async (
  database: IDBPDatabase<NovaDesktopDatabase>,
  storage: LegacyStorage,
) => {
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy || await database.count("items") > 0) {
    if (legacy) storage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }

  const items = JSON.parse(legacy) as DesktopItem[];
  const transaction = database.transaction(["items", "contents"], "readwrite");
  await Promise.all(items.map((item) => putDesktopItem(transaction, item)));
  await transaction.done;
  storage.removeItem(LEGACY_STORAGE_KEY);
};

const readDesktopFileFrom = async (
  database: IDBPDatabase<NovaDesktopDatabase>,
  metadata: DesktopItemMetadata,
): Promise<DesktopItem> => {
  if (metadata.type === "folder") return { ...metadata, content: "" };
  const stored = await database.get("contents", metadata.id);
  if (!stored) throw new Error(`Missing desktop content: ${metadata.id}`);
  return { ...metadata, content: await stored.content.text() };
};

export async function loadDesktopDirectory(
  parentId: string | null,
  storage: LegacyStorage = localStorage,
): Promise<DesktopItemMetadata[]> {
  const database = await openDesktopDatabase();
  try {
    await migrateLegacyStorage(database, storage);
    const records = await database.getAllFromIndex("items", "by-parent", parentId ?? ROOT_PARENT_KEY);
    return records.map(publicMetadata);
  } finally {
    database.close();
  }
}

export async function loadDesktopFile(
  id: string,
  storage: LegacyStorage = localStorage,
): Promise<DesktopItem | null> {
  const database = await openDesktopDatabase();
  try {
    await migrateLegacyStorage(database, storage);
    const stored = await database.get("items", id);
    return stored ? readDesktopFileFrom(database, publicMetadata(stored)) : null;
  } finally {
    database.close();
  }
}

export async function loadDesktopItems(storage: LegacyStorage = localStorage) {
  const database = await openDesktopDatabase();
  try {
    await migrateLegacyStorage(database, storage);
    const metadata = (await database.getAll("items")).map(publicMetadata);
    return Promise.all(metadata.map((item) => readDesktopFileFrom(database, item)));
  } finally {
    database.close();
  }
}

export async function loadDesktopWorkspace(storage: LegacyStorage = localStorage) {
  const pendingDirectories: Array<string | null> = [null];
  const metadata: DesktopItemMetadata[] = [];

  while (pendingDirectories.length) {
    const parentId = pendingDirectories.shift()!;
    const children = await loadDesktopDirectory(parentId, storage);
    metadata.push(...children);
    pendingDirectories.push(...children.filter((item) => item.type === "folder").map((item) => item.id));
  }

  return Promise.all(metadata.map(async (item) => {
    if (item.type === "folder") return { ...item, content: "" };
    const file = await loadDesktopFile(item.id, storage);
    if (!file) throw new Error(`Missing desktop file: ${item.id}`);
    return file;
  }));
}

export async function replaceDesktopItems(items: DesktopItem[]) {
  return serializeDesktopWrite(async () => {
    const database = await openDesktopDatabase();
    try {
      const transaction = database.transaction(["items", "contents"], "readwrite");
      await Promise.all([
        transaction.objectStore("items").clear(),
        transaction.objectStore("contents").clear(),
      ]);
      await Promise.all(items.map((item) => putDesktopItem(transaction, item)));
      await transaction.done;
    } finally {
      database.close();
    }
  });
}

export async function deleteDesktopItems(ids: string[]) {
  if (ids.length === 0) return;
  return serializeDesktopWrite(async () => {
    const database = await openDesktopDatabase();
    try {
      const transaction = database.transaction(["items", "contents"], "readwrite");
      await Promise.all(ids.flatMap((id) => [
        transaction.objectStore("items").delete(id),
        transaction.objectStore("contents").delete(id),
      ]));
      await transaction.done;
    } finally {
      database.close();
    }
  });
}

const metadataMatches = (left: DesktopItem, right: DesktopItem) => (
  left.id === right.id
  && left.type === right.type
  && left.name === right.name
  && left.parentId === right.parentId
  && left.createdAt === right.createdAt
  && left.lastOpenedAt === right.lastOpenedAt
  && left.deletedAt === right.deletedAt
);

async function persistDesktopChanges(previous: DesktopItem[], next: DesktopItem[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));
  const removed = previous.filter((item) => !nextIds.has(item.id)).map((item) => item.id);
  const metadataChanges = next.filter((item) => {
    const before = previousById.get(item.id);
    return !before || !metadataMatches(before, item);
  });
  const contentChanges = next.filter((item) => {
    const before = previousById.get(item.id);
    return item.type !== "folder" && (!before || before.content !== item.content);
  });
  if (metadataChanges.length === 0 && contentChanges.length === 0 && removed.length === 0) return;

  const database = await openDesktopDatabase();
  try {
    const transaction = database.transaction(["items", "contents"], "readwrite");
    await Promise.all([
      ...metadataChanges.map((item) => transaction.objectStore("items").put(metadataRecord(item))),
      ...contentChanges.map((item) => transaction.objectStore("contents").put(contentRecord(item))),
      ...removed.flatMap((id) => [
        transaction.objectStore("items").delete(id),
        transaction.objectStore("contents").delete(id),
      ]),
    ]);
    await transaction.done;
  } finally {
    database.close();
  }
}

export function createDesktopSyncQueue(initialItems: DesktopItem[]) {
  let committedItems = initialItems;

  return {
    enqueue(nextItems: DesktopItem[]) {
      return serializeDesktopWrite(async () => {
        await persistDesktopChanges(committedItems, nextItems);
        committedItems = nextItems;
      });
    },
  };
}
