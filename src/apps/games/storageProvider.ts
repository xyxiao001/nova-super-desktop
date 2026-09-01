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

export type YouTd2Record = {
  key: string;
  timestamp: number;
  mode: number;
  contents?: number[];
};

export type GameStorageProviderData = LocalStorageProviderData & {
  magicTower: MagicTowerRecord[];
  youTd2?: YouTd2Record[];
};

const MAGIC_TOWER_DATABASE = "nova-magic-tower";
const MAGIC_TOWER_STORE = "humanbreak_saves";
const LOCAL_FORAGE_BLOB_STORE = "local-forage-detect-blob-support";
const YOUTD2_DATABASE = "/userfs";
const YOUTD2_STORE = "FILE_DATA";

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

const openExistingDatabase = async (name: string): Promise<IDBDatabase | null> => {
  if (!(await databaseExists(name))) return null;
  return new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open(name);
    let created = false;
    request.onupgradeneeded = () => {
      created = true;
      request.transaction?.abort();
    };
    request.onerror = () => {
      if (created) resolve(null);
      else reject(request.error);
    };
    request.onsuccess = () => resolve(request.result);
  });
};

export async function readYouTd2Records(): Promise<YouTd2Record[]> {
  if (!("indexedDB" in globalThis)) return [];
  const database = await openExistingDatabase(YOUTD2_DATABASE);
  if (!database) return [];
  if (!database.objectStoreNames.contains(YOUTD2_STORE)) {
    database.close();
    return [];
  }
  return new Promise<YouTd2Record[]>((resolve, reject) => {
    const transaction = database.transaction(YOUTD2_STORE, "readonly");
    const cursor = transaction.objectStore(YOUTD2_STORE).openCursor();
    const records: YouTd2Record[] = [];
    cursor.onerror = () => reject(cursor.error);
    cursor.onsuccess = () => {
      if (!cursor.result) return;
      const value = cursor.result.value as {
        timestamp: Date | number;
        mode: number;
        contents?: ArrayBuffer | ArrayBufferView;
      };
      const contents = value.contents === undefined
        ? undefined
        : Array.from(value.contents instanceof ArrayBuffer
          ? new Uint8Array(value.contents)
          : new Uint8Array(value.contents.buffer, value.contents.byteOffset, value.contents.byteLength));
      records.push({
        key: String(cursor.result.key),
        timestamp: value.timestamp instanceof Date ? value.timestamp.getTime() : Number(value.timestamp),
        mode: value.mode,
        ...(contents ? { contents } : {}),
      });
      cursor.result.continue();
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(records);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function replaceYouTd2Records(records: YouTd2Record[]) {
  if (!("indexedDB" in globalThis)) {
    if (records.length) throw new Error("IndexedDB unavailable");
    return;
  }
  if (!records.length) {
    const database = await openExistingDatabase(YOUTD2_DATABASE);
    if (!database) return;
    if (!database.objectStoreNames.contains(YOUTD2_STORE)) {
      database.close();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(YOUTD2_STORE, "readwrite");
      transaction.objectStore(YOUTD2_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return;
  }
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(YOUTD2_DATABASE, 21);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains(YOUTD2_STORE)
        ? request.transaction!.objectStore(YOUTD2_STORE)
        : request.result.createObjectStore(YOUTD2_STORE);
      if (!store.indexNames.contains("timestamp")) {
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  if (!database.objectStoreNames.contains(YOUTD2_STORE)) {
    database.close();
    throw new Error("YouTD 2 storage unavailable");
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(YOUTD2_STORE, "readwrite");
    const store = transaction.objectStore(YOUTD2_STORE);
    store.clear();
    for (const record of records) {
      store.put({
        timestamp: new Date(record.timestamp),
        mode: record.mode,
        ...(record.contents ? { contents: new Uint8Array(record.contents) } : {}),
      }, record.key);
    }
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

const isYouTd2Record = (value: unknown): value is YouTd2Record => (
  !!value
  && typeof value === "object"
  && "key" in value
  && typeof value.key === "string"
  && "timestamp" in value
  && typeof value.timestamp === "number"
  && "mode" in value
  && typeof value.mode === "number"
  && (!("contents" in value)
    || (Array.isArray(value.contents)
      && value.contents.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)))
);

const isGameStorageProviderData = (
  value: unknown,
): value is GameStorageProviderData => (
  isLocalStorageProviderDataFor("games", value)
  && "magicTower" in value
  && Array.isArray(value.magicTower)
  && value.magicTower.every(isMagicTowerRecord)
  && (!("youTd2" in value)
    || (Array.isArray(value.youTd2) && value.youTd2.every(isYouTd2Record)))
);

const gamesProvider: StorageProvider = {
  id: "games",
  label: "游戏数据",
  displayOrder: 3,
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 项存档、战绩与游戏设置`,
  inspect: async () => {
    const entries = localStorageEntries("games");
    const [magicTower, youTd2] = await Promise.all([
      readMagicTowerRecords(),
      readYouTd2Records(),
    ]);
    return {
      entries: Object.keys(entries).length + magicTower.length + youTd2.length,
      bytes: localStorageSize(entries)
        + (magicTower.length ? encodedSize(magicTower) : 0)
        + (youTd2.length ? encodedSize(youTd2) : 0),
    };
  },
  exportData: async () => ({
    localStorage: localStorageEntries("games"),
    magicTower: await readMagicTowerRecords(),
    youTd2: await readYouTd2Records(),
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
    await Promise.all([
      replaceMagicTowerRecords(data.magicTower),
      replaceYouTd2Records(data.youTd2 ?? []),
    ]);
  },
  clear: async () => {
    clearLocalStorageCategory("games");
    await Promise.all([
      replaceMagicTowerRecords([]),
      replaceYouTd2Records([]),
    ]);
  },
};

export default gamesProvider;
