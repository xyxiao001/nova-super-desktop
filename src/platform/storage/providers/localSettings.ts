import type {
  LocalStorageProviderData,
  BuiltInStorageProviderId,
  StorageProvider,
  StorageStats,
} from "./types";

type LocalProviderId = Exclude<
  BuiltInStorageProviderId,
  "desktop" | "reader" | "calendar" | "games"
>;
type LocalCategoryId = Exclude<
  BuiltInStorageProviderId,
  "desktop" | "reader" | "calendar"
>;

const LEGACY_KEYS = new Set(["nova-desktop-items", "nova-reader-downloads"]);
export const MAGIC_TOWER_STORAGE_PREFIX = "HumanBreak_";
const encoder = new TextEncoder();

export const localStorageCategory = (key: string): LocalCategoryId => {
  if (
    key.startsWith("nova-game-")
    || key.startsWith("nova-mines-")
    || key.startsWith(MAGIC_TOWER_STORAGE_PREFIX)
  ) return "games";
  if (key.startsWith("nova-reader-")) return "reading";
  if (key.startsWith("nova-focus-")) return "focus";
  if (
    key === "nova-settings"
    || key === "nova-calendar-almanac-enabled"
    || key === "nova-desktop-positions"
    || key.startsWith("nova-window-geometry:")
  ) return "settings";
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

export const localStorageEntries = (id: LocalCategoryId) => Object.fromEntries(
  getManagedLocalStorageKeys()
    .filter((key) => localStorageCategory(key) === id)
    .map((key) => [key, localStorage.getItem(key)!]),
);

export const clearLocalStorageCategory = (id: LocalCategoryId) => {
  for (const key of getManagedLocalStorageKeys()) {
    if (localStorageCategory(key) === id) localStorage.removeItem(key);
  }
};

export const localStorageSize = (entries: Record<string, string>) =>
  Object.entries(entries).reduce(
    (total, [key, value]) =>
      total + encoder.encode(key).byteLength + encoder.encode(value).byteLength,
    0,
  );

const isStringRecord = (value: unknown): value is Record<string, string> => (
  !!value
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.values(value).every((entry) => typeof entry === "string")
);

const isLocalStorageProviderData = (
  value: unknown,
): value is LocalStorageProviderData => (
  !!value
  && typeof value === "object"
  && "localStorage" in value
  && isStringRecord(value.localStorage)
);

export const isLocalStorageProviderDataFor = (
  id: LocalCategoryId,
  value: unknown,
): value is LocalStorageProviderData => (
  isLocalStorageProviderData(value)
  && Object.keys(value.localStorage).every((key) => (
    isManagedLocalStorageKey(key)
    && localStorageCategory(key) === id
  ))
);

export const createLocalStorageProvider = (
  id: LocalProviderId,
  label: string,
  displayOrder: number,
  description: (stats: StorageStats) => string,
  showWhenEmpty = true,
): StorageProvider => ({
  id,
  label,
  displayOrder,
  showWhenEmpty,
  description,
  inspect: async () => {
    const entries = localStorageEntries(id);
    return { entries: Object.keys(entries).length, bytes: localStorageSize(entries) };
  },
  exportData: async () => ({ localStorage: localStorageEntries(id) }),
  validateData: (data) => isLocalStorageProviderDataFor(id, data),
  restoreData: async (data) => {
    if (!isLocalStorageProviderDataFor(id, data)) {
      throw new Error(`Invalid ${id} backup data`);
    }
    clearLocalStorageCategory(id);
    for (const [key, value] of Object.entries(data.localStorage)) {
      localStorage.setItem(key, value);
    }
  },
  clear: async () => clearLocalStorageCategory(id),
});

export const OTHER_STORAGE_PROVIDER = createLocalStorageProvider(
  "other",
  "其他本地数据",
  7,
  (stats) => `${stats.entries} 项未分类应用数据`,
  false,
);
