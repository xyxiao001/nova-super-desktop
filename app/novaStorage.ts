import { deleteDesktopItems, loadDesktopItems } from "./desktopStorage";
import { getAllStoredBooks, replaceStoredBooks } from "./readerStorage";

export type NovaStorageCategoryId =
  | "desktop"
  | "reader"
  | "games"
  | "reading"
  | "focus"
  | "settings"
  | "other";

export type NovaStorageCategory = {
  id: NovaStorageCategoryId;
  label: string;
  description: string;
  entries: number;
  bytes: number;
  canClear: boolean;
};

const LEGACY_KEYS = new Set(["nova-desktop-items", "nova-reader-downloads"]);
const MAGIC_TOWER_STORAGE_PREFIX = "HumanBreak_";
const MAGIC_TOWER_DATABASE = "nova-magic-tower";
const encoder = new TextEncoder();

const encodedSize = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength;

const getNovaLocalStorageEntries = () => Array.from(
  { length: localStorage.length },
  (_, index) => localStorage.key(index),
).filter((key): key is string => (
  !!key
  && (key.startsWith("nova-") || key.startsWith(MAGIC_TOWER_STORAGE_PREFIX))
  && !LEGACY_KEYS.has(key)
));

const localCategory = (key: string): Exclude<NovaStorageCategoryId, "desktop" | "reader"> => {
  if (
    key.startsWith("nova-game-")
    || key.startsWith("nova-mines-")
    || key.startsWith(MAGIC_TOWER_STORAGE_PREFIX)
  ) return "games";
  if (key.startsWith("nova-reader-")) return "reading";
  if (key.startsWith("nova-focus-")) return "focus";
  if (key === "nova-settings" || key === "nova-desktop-positions" || key.startsWith("nova-window-geometry:")) return "settings";
  return "other";
};

const localStorageSize = (keys: string[]) => keys.reduce((total, key) => (
  total + encoder.encode(key).byteLength + encoder.encode(localStorage.getItem(key) ?? "").byteLength
), 0);

const inspectMagicTowerStorage = async () => {
  if (!("indexedDB" in globalThis)) return { entries: 0, bytes: 0 };
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (!factory.databases) return { entries: 0, bytes: 0 };
  const databases = await factory.databases();
  if (!databases.some((database) => database.name === MAGIC_TOWER_DATABASE)) {
    return { entries: 0, bytes: 0 };
  }
  return new Promise<{ entries: number; bytes: number }>((resolve, reject) => {
    const request = indexedDB.open(MAGIC_TOWER_DATABASE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("humanbreak_saves")) {
        database.close();
        resolve({ entries: 0, bytes: 0 });
        return;
      }
      const transaction = database.transaction("humanbreak_saves", "readonly");
      const cursor = transaction.objectStore("humanbreak_saves").openCursor();
      let entries = 0;
      let bytes = 0;
      cursor.onerror = () => reject(cursor.error);
      cursor.onsuccess = () => {
        if (!cursor.result) return;
        entries += 1;
        bytes += encodedSize(cursor.result.value);
        cursor.result.continue();
      };
      transaction.oncomplete = () => {
        database.close();
        resolve({ entries, bytes });
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
};

const clearMagicTowerDatabase = async () => {
  if (!("indexedDB" in globalThis)) {
    return;
  }
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (factory.databases) {
    const databases = await factory.databases();
    if (!databases.some((database) => database.name === MAGIC_TOWER_DATABASE)) return;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(MAGIC_TOWER_DATABASE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("humanbreak_saves")) {
        database.close();
        resolve();
        return;
      }
      const transaction = database.transaction("humanbreak_saves", "readwrite");
      transaction.objectStore("humanbreak_saves").clear();
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
};

export async function inspectNovaStorage(): Promise<NovaStorageCategory[]> {
  const [desktopItems, readerBooks, magicTower] = await Promise.all([
    loadDesktopItems(),
    getAllStoredBooks(),
    inspectMagicTowerStorage(),
  ]);
  const localEntries = getNovaLocalStorageEntries();
  const localGroups = {
    games: localEntries.filter((key) => localCategory(key) === "games"),
    reading: localEntries.filter((key) => localCategory(key) === "reading"),
    focus: localEntries.filter((key) => localCategory(key) === "focus"),
    settings: localEntries.filter((key) => localCategory(key) === "settings"),
    other: localEntries.filter((key) => localCategory(key) === "other"),
  };

  const categories: NovaStorageCategory[] = [
    {
      id: "desktop",
      label: "桌面文件",
      description: `${desktopItems.length} 个项目，包含回收站内容`,
      entries: desktopItems.length,
      bytes: desktopItems.length ? encodedSize(desktopItems) : 0,
      canClear: desktopItems.length > 0,
    },
    {
      id: "reader",
      label: "离线书籍",
      description: `${readerBooks.length} 本已下载书籍`,
      entries: readerBooks.length,
      bytes: readerBooks.length ? encodedSize(readerBooks) : 0,
      canClear: readerBooks.length > 0,
    },
    {
      id: "games",
      label: "游戏数据",
      description: `${localGroups.games.length + magicTower.entries} 项存档、战绩与游戏设置`,
      entries: localGroups.games.length + magicTower.entries,
      bytes: localStorageSize(localGroups.games) + magicTower.bytes,
      canClear: localGroups.games.length + magicTower.entries > 0,
    },
    {
      id: "reading",
      label: "阅读记录",
      description: `${localGroups.reading.length} 项进度、书签与偏好`,
      entries: localGroups.reading.length,
      bytes: localStorageSize(localGroups.reading),
      canClear: localGroups.reading.length > 0,
    },
    {
      id: "focus",
      label: "专注记录",
      description: `${localGroups.focus.length} 项专注历史`,
      entries: localGroups.focus.length,
      bytes: localStorageSize(localGroups.focus),
      canClear: localGroups.focus.length > 0,
    },
    {
      id: "settings",
      label: "桌面设置",
      description: `${localGroups.settings.length} 项主题、布局与窗口位置`,
      entries: localGroups.settings.length,
      bytes: localStorageSize(localGroups.settings),
      canClear: localGroups.settings.length > 0,
    },
  ];
  if (localGroups.other.length) {
    categories.push({
      id: "other",
      label: "其他本地数据",
      description: `${localGroups.other.length} 项未分类应用数据`,
      entries: localGroups.other.length,
      bytes: localStorageSize(localGroups.other),
      canClear: true,
    });
  }
  return categories;
}

export async function clearNovaStorageCategory(id: NovaStorageCategoryId) {
  if (id === "desktop") {
    const items = await loadDesktopItems();
    await deleteDesktopItems(items.map((item) => item.id));
    return;
  }
  if (id === "reader") {
    await replaceStoredBooks([]);
    return;
  }
  for (const key of getNovaLocalStorageEntries()) {
    if (localCategory(key) === id) localStorage.removeItem(key);
  }
  if (id === "games") await clearMagicTowerDatabase();
}
