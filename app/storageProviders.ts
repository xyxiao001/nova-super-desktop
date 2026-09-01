import type { StoredBook } from "./readerCore";
import type { DesktopItem } from "./desktopFiles";
import { isCalendarEvent, type CalendarEvent } from "./calendarEventCore";
import { getAllCalendarEvents, replaceCalendarEvents } from "./calendarEventStorage";
import {
  deleteDesktopItems,
  loadDesktopItems,
  replaceDesktopItems,
} from "./desktopStorage";
import { getAllStoredBooks, replaceStoredBooks } from "./readerStorage";

export type StorageProviderId =
  | "desktop"
  | "reader"
  | "calendar"
  | "games"
  | "reading"
  | "focus"
  | "settings"
  | "other";

export type StorageStats = {
  entries: number;
  bytes: number;
};

export type StorageProvider = {
  id: StorageProviderId;
  label: string;
  showWhenEmpty: boolean;
  description: (stats: StorageStats) => string;
  inspect: () => Promise<StorageStats>;
  exportData: () => Promise<unknown>;
  validateData: (data: unknown) => boolean;
  restoreData: (data: unknown) => Promise<void>;
  clear: () => Promise<void>;
};

export type LocalStorageProviderData = {
  localStorage: Record<string, string>;
};

export type MagicTowerRecord = {
  key: string;
  value: unknown;
};

export type GameStorageProviderData = LocalStorageProviderData & {
  magicTower: MagicTowerRecord[];
};

const LEGACY_KEYS = new Set(["nova-desktop-items", "nova-reader-downloads"]);
const MAGIC_TOWER_STORAGE_PREFIX = "HumanBreak_";
const MAGIC_TOWER_DATABASE = "nova-magic-tower";
const MAGIC_TOWER_STORE = "humanbreak_saves";
const LOCAL_FORAGE_BLOB_STORE = "local-forage-detect-blob-support";
const encoder = new TextEncoder();

const encodedSize = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength;

export const localStorageCategory = (
  key: string,
): Exclude<StorageProviderId, "desktop" | "reader" | "calendar"> => {
  if (
    key.startsWith("nova-game-")
    || key.startsWith("nova-mines-")
    || key.startsWith(MAGIC_TOWER_STORAGE_PREFIX)
  ) return "games";
  if (key.startsWith("nova-reader-")) return "reading";
  if (key.startsWith("nova-focus-")) return "focus";
  if (key === "nova-settings" || key === "nova-calendar-almanac-enabled" || key === "nova-desktop-positions" || key.startsWith("nova-window-geometry:")) return "settings";
  return "other";
};

export const getManagedLocalStorageKeys = () => Array.from(
  { length: localStorage.length },
  (_, index) => localStorage.key(index),
).filter((key): key is string => (
  !!key
  && (key.startsWith("nova-") || key.startsWith(MAGIC_TOWER_STORAGE_PREFIX))
  && !LEGACY_KEYS.has(key)
));

const isManagedLocalStorageKey = (key: string) => (
  (key.startsWith("nova-") || key.startsWith(MAGIC_TOWER_STORAGE_PREFIX))
  && !LEGACY_KEYS.has(key)
);

const localStorageEntries = (id: Exclude<StorageProviderId, "desktop" | "reader" | "calendar">) => Object.fromEntries(
  getManagedLocalStorageKeys()
    .filter((key) => localStorageCategory(key) === id)
    .map((key) => [key, localStorage.getItem(key)!]),
);

const clearLocalStorageCategory = (id: Exclude<StorageProviderId, "desktop" | "reader" | "calendar">) => {
  for (const key of getManagedLocalStorageKeys()) {
    if (localStorageCategory(key) === id) localStorage.removeItem(key);
  }
};

const localStorageSize = (entries: Record<string, string>) => Object.entries(entries).reduce(
  (total, [key, value]) => total + encoder.encode(key).byteLength + encoder.encode(value).byteLength,
  0,
);

const isStringRecord = (value: unknown): value is Record<string, string> => (
  !!value
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.values(value).every((entry) => typeof entry === "string")
);

const isLocalStorageProviderData = (value: unknown): value is LocalStorageProviderData => (
  !!value
  && typeof value === "object"
  && "localStorage" in value
  && isStringRecord(value.localStorage)
);

const isLocalStorageProviderDataFor = (
  id: Exclude<StorageProviderId, "desktop" | "reader" | "calendar">,
  value: unknown,
): value is LocalStorageProviderData => (
  isLocalStorageProviderData(value)
  && Object.keys(value.localStorage).every((key) => (
    isManagedLocalStorageKey(key)
    && localStorageCategory(key) === id
  ))
);

const isDesktopItem = (value: unknown): value is DesktopItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DesktopItem>;
  return (
    typeof item.id === "string"
    && ["folder", "text", "image"].includes(item.type ?? "")
    && typeof item.name === "string"
    && typeof item.content === "string"
    && (item.parentId === null || typeof item.parentId === "string")
    && typeof item.createdAt === "number"
  );
};

const isStoredBook = (value: unknown): value is StoredBook => {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<StoredBook>;
  return (
    typeof book.id === "string"
    && typeof book.title === "string"
    && typeof book.author === "string"
    && typeof book.description === "string"
    && typeof book.cover === "string"
    && typeof book.file === "string"
    && typeof book.url === "string"
    && typeof book.size === "number"
    && typeof book.version === "string"
    && typeof book.content === "string"
    && typeof book.downloadedAt === "number"
    && (book.chapterIndex === undefined || Array.isArray(book.chapterIndex))
  );
};

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

const isGameStorageProviderData = (value: unknown): value is GameStorageProviderData => (
  isLocalStorageProviderDataFor("games", value)
  && "magicTower" in value
  && Array.isArray(value.magicTower)
  && value.magicTower.every(isMagicTowerRecord)
);

const desktopProvider: StorageProvider = {
  id: "desktop",
  label: "桌面文件",
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 个项目，包含回收站内容`,
  inspect: async () => {
    const items = await loadDesktopItems();
    return { entries: items.length, bytes: items.length ? encodedSize(items) : 0 };
  },
  exportData: () => loadDesktopItems(),
  validateData: (data) => Array.isArray(data) && data.every(isDesktopItem),
  restoreData: async (data) => {
    if (!Array.isArray(data) || !data.every(isDesktopItem)) throw new Error("Invalid desktop backup data");
    await replaceDesktopItems(data);
  },
  clear: async () => {
    const items = await loadDesktopItems();
    await deleteDesktopItems(items.map((item) => item.id));
  },
};

const readerProvider: StorageProvider = {
  id: "reader",
  label: "离线书籍",
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 本已下载书籍`,
  inspect: async () => {
    const books = await getAllStoredBooks();
    return { entries: books.length, bytes: books.length ? encodedSize(books) : 0 };
  },
  exportData: () => getAllStoredBooks(),
  validateData: (data) => Array.isArray(data) && data.every(isStoredBook),
  restoreData: async (data) => {
    if (!Array.isArray(data) || !data.every(isStoredBook)) throw new Error("Invalid reader backup data");
    await replaceStoredBooks(data);
  },
  clear: () => replaceStoredBooks([]),
};

const localProvider = (
  id: Exclude<StorageProviderId, "desktop" | "reader" | "calendar" | "games">,
  label: string,
  description: (stats: StorageStats) => string,
  showWhenEmpty = true,
): StorageProvider => ({
  id,
  label,
  showWhenEmpty,
  description,
  inspect: async () => {
    const entries = localStorageEntries(id);
    return { entries: Object.keys(entries).length, bytes: localStorageSize(entries) };
  },
  exportData: async () => ({ localStorage: localStorageEntries(id) }),
  validateData: (data) => isLocalStorageProviderDataFor(id, data),
  restoreData: async (data) => {
    if (!isLocalStorageProviderDataFor(id, data)) throw new Error(`Invalid ${id} backup data`);
    clearLocalStorageCategory(id);
    for (const [key, value] of Object.entries(data.localStorage)) localStorage.setItem(key, value);
  },
  clear: async () => clearLocalStorageCategory(id),
});

const gamesProvider: StorageProvider = {
  id: "games",
  label: "游戏数据",
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 项存档、战绩与游戏设置`,
  inspect: async () => {
    const entries = localStorageEntries("games");
    const magicTower = await readMagicTowerRecords();
    return {
      entries: Object.keys(entries).length + magicTower.length,
      bytes: localStorageSize(entries) + (magicTower.length ? encodedSize(magicTower) : 0),
    };
  },
  exportData: async () => ({
    localStorage: localStorageEntries("games"),
    magicTower: await readMagicTowerRecords(),
  }),
  validateData: isGameStorageProviderData,
  restoreData: async (data) => {
    if (!isGameStorageProviderData(data)) throw new Error("Invalid games backup data");
    clearLocalStorageCategory("games");
    for (const [key, value] of Object.entries(data.localStorage)) localStorage.setItem(key, value);
    await replaceMagicTowerRecords(data.magicTower);
  },
  clear: async () => {
    clearLocalStorageCategory("games");
    await replaceMagicTowerRecords([]);
  },
};

const calendarProvider: StorageProvider = {
  id: "calendar",
  label: "日历日程",
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 项个人日程`,
  inspect: async () => {
    const events = await getAllCalendarEvents();
    return { entries: events.length, bytes: events.length ? encodedSize(events) : 0 };
  },
  exportData: () => getAllCalendarEvents(),
  validateData: (data) => Array.isArray(data) && data.every(isCalendarEvent),
  restoreData: async (data) => {
    if (!Array.isArray(data) || !data.every(isCalendarEvent)) throw new Error("Invalid calendar backup data");
    await replaceCalendarEvents(data as CalendarEvent[]);
  },
  clear: () => replaceCalendarEvents([]),
};

export const STORAGE_PROVIDERS: readonly StorageProvider[] = [
  desktopProvider,
  readerProvider,
  calendarProvider,
  gamesProvider,
  localProvider("reading", "阅读记录", (stats) => `${stats.entries} 项进度、书签与偏好`),
  localProvider("focus", "专注记录", (stats) => `${stats.entries} 项专注历史`),
  localProvider("settings", "桌面设置", (stats) => `${stats.entries} 项主题、布局与窗口位置`),
  localProvider("other", "其他本地数据", (stats) => `${stats.entries} 项未分类应用数据`, false),
];

export const STORAGE_PROVIDER_BY_ID = Object.fromEntries(
  STORAGE_PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<StorageProviderId, StorageProvider>;
