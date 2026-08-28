import { openDB, type DBSchema } from "idb";

import type { DesktopItem } from "./desktopFiles";

const DATABASE_NAME = "nova-desktop";
const LEGACY_STORAGE_KEY = "nova-desktop-items";

interface NovaDesktopDatabase extends DBSchema {
  items: {
    key: string;
    value: DesktopItem;
  };
}

type LegacyStorage = Pick<Storage, "getItem" | "removeItem">;
let databaseWriteQueue: Promise<void> = Promise.resolve();

const serializeDesktopWrite = (write: () => Promise<void>) => {
  const operation = databaseWriteQueue.catch(() => undefined).then(write);
  databaseWriteQueue = operation.catch(() => undefined);
  return operation;
};

const openDesktopDatabase = () => openDB<NovaDesktopDatabase>(DATABASE_NAME, 1, {
  upgrade(database) {
    database.createObjectStore("items", { keyPath: "id" });
  },
});

export async function loadDesktopItems(storage: LegacyStorage = localStorage) {
  const database = await openDesktopDatabase();
  try {
    let items = await database.getAll("items");
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && items.length === 0) {
      items = JSON.parse(legacy) as DesktopItem[];
      const transaction = database.transaction("items", "readwrite");
      await Promise.all(items.map((item) => transaction.store.put(item)));
      await transaction.done;
    }
    if (legacy) storage.removeItem(LEGACY_STORAGE_KEY);
    return items;
  } finally {
    database.close();
  }
}

export async function replaceDesktopItems(items: DesktopItem[]) {
  return serializeDesktopWrite(async () => {
    const database = await openDesktopDatabase();
    try {
      const transaction = database.transaction("items", "readwrite");
      await transaction.store.clear();
      await Promise.all(items.map((item) => transaction.store.put(item)));
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
      const transaction = database.transaction("items", "readwrite");
      await Promise.all(ids.map((id) => transaction.store.delete(id)));
      await transaction.done;
    } finally {
      database.close();
    }
  });
}

async function persistDesktopChanges(previous: DesktopItem[], next: DesktopItem[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));
  const changed = next.filter((item) => previousById.get(item.id) !== item);
  const removed = previous.filter((item) => !nextIds.has(item.id)).map((item) => item.id);
  if (changed.length === 0 && removed.length === 0) return;

  const database = await openDesktopDatabase();
  try {
    const transaction = database.transaction("items", "readwrite");
    await Promise.all([
      ...changed.map((item) => transaction.store.put(item)),
      ...removed.map((id) => transaction.store.delete(id)),
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
