import {
  clearLocalStorageCategory,
  isLocalStorageProviderDataFor,
  localStorageEntries,
  localStorageSize,
} from "../../platform/storage/providers/localSettings";
import {
  encodedSize,
  type LocalStorageProviderData,
  type StorageProvider,
} from "../../platform/storage/providers/types";

export type MagicTowerRecord = {
  key: string;
  value: unknown;
};

export type GameStorageProviderData = LocalStorageProviderData & {
  magicTower: MagicTowerRecord[];
};

const MAGIC_TOWER_DATABASE = "nova-magic-tower";
const MAGIC_TOWER_STORE = "humanbreak_saves";
const LOCAL_FORAGE_BLOB_STORE = "local-forage-detect-blob-support";

const databaseExists = async (name: string) => {
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (!factory.databases) return true;
  return (await factory.databases()).some((database) => database.name === name);
};

const openMagicTowerDatabase = async (create: boolean) => {
  if (!(await databaseExists(MAGIC_TOWER_DATABASE)) && !create) return null;
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(MAGIC_TOWER_DATABASE);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!create) return;
      if (!request.result.objectStoreNames.contains(MAGIC_TOWER_STORE)) {
        request.result.createObjectStore(MAGIC_TOWER_STORE);
      }
      if (!request.result.objectStoreNames.contains(LOCAL_FORAGE_BLOB_STORE)) {
        request.result.createObjectStore(LOCAL_FORAGE_BLOB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
};

export async function readMagicTowerRecords(): Promise<MagicTowerRecord[]> {
  if (!("indexedDB" in globalThis)) return [];
  const database = await openMagicTowerDatabase(false);
  if (!database) return [];
  if (!database.objectStoreNames.contains(MAGIC_TOWER_STORE)) {
    database.close();
    return [];
  }
  return new Promise<MagicTowerRecord[]>((resolve, reject) => {
    const transaction = database.transaction(MAGIC_TOWER_STORE, "readonly");
    const cursor = transaction.objectStore(MAGIC_TOWER_STORE).openCursor();
    const records: MagicTowerRecord[] = [];
    cursor.onerror = () => reject(cursor.error);
    cursor.onsuccess = () => {
      if (!cursor.result) return;
      records.push({ key: String(cursor.result.key), value: cursor.result.value });
      cursor.result.continue();
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(records);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function replaceMagicTowerRecords(records: MagicTowerRecord[]) {
  if (!("indexedDB" in globalThis)) {
    if (records.length) throw new Error("IndexedDB unavailable");
    return;
  }
  const database = await openMagicTowerDatabase(records.length > 0);
  if (!database) return;
  if (!database.objectStoreNames.contains(MAGIC_TOWER_STORE)) {
    database.close();
    if (records.length) throw new Error("Magic Tower storage unavailable");
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MAGIC_TOWER_STORE, "readwrite");
    const store = transaction.objectStore(MAGIC_TOWER_STORE);
    store.clear();
    for (const record of records) store.put(record.value, record.key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

const isMagicTowerRecord = (value: unknown): value is MagicTowerRecord => (
  !!value
  && typeof value === "object"
  && "key" in value
  && typeof value.key === "string"
  && "value" in value
);

const isGameStorageProviderData = (
  value: unknown,
): value is GameStorageProviderData => (
  isLocalStorageProviderDataFor("games", value)
  && "magicTower" in value
  && Array.isArray(value.magicTower)
  && value.magicTower.every(isMagicTowerRecord)
);

const gamesProvider: StorageProvider = {
  id: "games",
  label: "游戏数据",
  displayOrder: 3,
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 项存档、战绩与游戏设置`,
  inspect: async () => {
    const entries = localStorageEntries("games");
    const magicTower = await readMagicTowerRecords();
    return {
      entries: Object.keys(entries).length + magicTower.length,
      bytes: localStorageSize(entries)
        + (magicTower.length ? encodedSize(magicTower) : 0),
    };
  },
  exportData: async () => ({
    localStorage: localStorageEntries("games"),
    magicTower: await readMagicTowerRecords(),
  }),
  validateData: isGameStorageProviderData,
  restoreData: async (data) => {
    if (!isGameStorageProviderData(data)) {
      throw new Error("Invalid games backup data");
    }
    clearLocalStorageCategory("games");
    for (const [key, value] of Object.entries(data.localStorage)) {
      localStorage.setItem(key, value);
    }
    await replaceMagicTowerRecords(data.magicTower);
  },
  clear: async () => {
    clearLocalStorageCategory("games");
    await replaceMagicTowerRecords([]);
  },
};

export default gamesProvider;
