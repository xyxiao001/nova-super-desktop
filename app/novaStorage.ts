import { deleteDesktopItems, loadDesktopItems } from "./desktopStorage";
import { getAllStoredBooks, replaceStoredBooks } from "./readerStorage";

export type NovaStorageCategoryId =
  | "desktop"
  | "reader"
  | "games"
  | "reading"
  | "focus"
  | "settings"
  | "offline"
  | "other";

export type NovaStorageCategory = {
  id: NovaStorageCategoryId;
  label: string;
  description: string;
  entries: number;
  bytes: number;
  canClear: boolean;
};

const CACHE_PREFIX = "nova-pwa-";
const LEGACY_KEYS = new Set(["nova-desktop-items", "nova-reader-downloads"]);
const encoder = new TextEncoder();

const encodedSize = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength;

const getNovaLocalStorageEntries = () => Array.from(
  { length: localStorage.length },
  (_, index) => localStorage.key(index),
).filter((key): key is string => !!key && key.startsWith("nova-") && !LEGACY_KEYS.has(key));

const localCategory = (key: string): Exclude<NovaStorageCategoryId, "desktop" | "reader" | "offline"> => {
  if (key.startsWith("nova-game-") || key.startsWith("nova-mines-")) return "games";
  if (key.startsWith("nova-reader-")) return "reading";
  if (key.startsWith("nova-focus-")) return "focus";
  if (key === "nova-settings" || key === "nova-desktop-positions" || key.startsWith("nova-window-geometry:")) return "settings";
  return "other";
};

const localStorageSize = (keys: string[]) => keys.reduce((total, key) => (
  total + encoder.encode(key).byteLength + encoder.encode(localStorage.getItem(key) ?? "").byteLength
), 0);

const inspectOfflineCache = async () => {
  if (!("caches" in globalThis)) return { names: [] as string[], entries: 0, bytes: 0 };
  const names = (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX));
  let entries = 0;
  let bytes = 0;
  for (const name of names) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    entries += requests.length;
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) bytes += (await response.clone().arrayBuffer()).byteLength;
    }
  }
  return { names, entries, bytes };
};

export async function inspectNovaStorage(): Promise<NovaStorageCategory[]> {
  const [desktopItems, readerBooks, offline] = await Promise.all([
    loadDesktopItems(),
    getAllStoredBooks(),
    inspectOfflineCache(),
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
      description: `${localGroups.games.length} 项存档与战绩`,
      entries: localGroups.games.length,
      bytes: localStorageSize(localGroups.games),
      canClear: localGroups.games.length > 0,
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
    {
      id: "offline",
      label: "PWA 离线缓存",
      description: offline.names.length
        ? `${offline.entries} 个资源 · ${offline.names.join("、")}`
        : "尚未缓存离线资源",
      entries: offline.entries,
      bytes: offline.bytes,
      canClear: offline.names.length > 0,
    },
  ];
  if (localGroups.other.length) {
    categories.splice(-1, 0, {
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
  if (id !== "offline") {
    for (const key of getNovaLocalStorageEntries()) {
      if (localCategory(key) === id) localStorage.removeItem(key);
    }
    return;
  }
  if (!("caches" in globalThis)) return;
  const names = (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX));
  await Promise.all(names.map((name) => caches.delete(name)));
}
