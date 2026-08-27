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
  let latestItems = initialItems;
  let queue = Promise.resolve();

  return {
    enqueue(nextItems: DesktopItem[]) {
      latestItems = nextItems;
      const operation = queue.catch(() => undefined).then(async () => {
        const targetItems = latestItems;
        await persistDesktopChanges(committedItems, targetItems);
        committedItems = targetItems;
      });
      queue = operation;
      return operation;
    },
  };
}
