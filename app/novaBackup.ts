import {
  STORAGE_PROVIDER_BY_ID,
  STORAGE_PROVIDERS,
  localStorageCategory,
  type GameStorageProviderData,
  type LocalStorageProviderData,
  type StorageProviderId,
} from "./storageProviders";

const BACKUP_VERSION = 2;
const LEGACY_BACKUP_VERSION = 1;
const LEGACY_KEYS = new Set(["nova-desktop-items", "nova-reader-downloads"]);

export type NovaBackup = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  providers: Record<StorageProviderId, unknown>;
};

type NovaBackupV1 = {
  version: typeof LEGACY_BACKUP_VERSION;
  exportedAt: string;
  desktopItems: unknown;
  readerBooks: unknown;
  localStorage: Record<string, string>;
};

export type NovaBackupSummary = {
  exportedAt: string;
  desktopItems: number;
  readerBooks: number;
  localSettings: number;
};

const isObject = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === "object" && !Array.isArray(value)
);

const hasValidExportDate = (value: Record<string, unknown>) => (
  typeof value.exportedAt === "string"
  && Number.isFinite(Date.parse(value.exportedAt))
);

const isVersionTwoBackup = (value: unknown): value is NovaBackup => {
  if (!isObject(value) || value.version !== BACKUP_VERSION || !hasValidExportDate(value)) return false;
  const providers = value.providers;
  if (!isObject(providers)) return false;
  const providerIds = STORAGE_PROVIDERS.map((provider) => provider.id);
  if (
    Object.keys(providers).length !== providerIds.length
    || !providerIds.every((id) => id in providers)
  ) return false;
  return STORAGE_PROVIDERS.every((provider) => provider.validateData(providers[provider.id]));
};

const isVersionOneBackup = (value: unknown): value is NovaBackupV1 => {
  if (!isObject(value) || value.version !== LEGACY_BACKUP_VERSION || !hasValidExportDate(value)) return false;
  if (!STORAGE_PROVIDER_BY_ID.desktop.validateData(value.desktopItems)) return false;
  if (!STORAGE_PROVIDER_BY_ID.reader.validateData(value.readerBooks)) return false;
  if (!isObject(value.localStorage)) return false;
  return Object.entries(value.localStorage).every(([key, entry]) => (
    key.startsWith("nova-")
    && !LEGACY_KEYS.has(key)
    && typeof entry === "string"
  ));
};

const normalizeVersionOneBackup = (backup: NovaBackupV1): NovaBackup => {
  const providers: Record<StorageProviderId, unknown> = {
    desktop: backup.desktopItems,
    reader: backup.readerBooks,
    games: { localStorage: {}, magicTower: [] } satisfies GameStorageProviderData,
    reading: { localStorage: {} } satisfies LocalStorageProviderData,
    focus: { localStorage: {} } satisfies LocalStorageProviderData,
    settings: { localStorage: {} } satisfies LocalStorageProviderData,
    other: { localStorage: {} } satisfies LocalStorageProviderData,
  };

  for (const [key, value] of Object.entries(backup.localStorage)) {
    const id = localStorageCategory(key);
    const data = providers[id] as LocalStorageProviderData;
    data.localStorage[key] = value;
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: backup.exportedAt,
    providers,
  };
};

export async function createNovaBackup(): Promise<NovaBackup> {
  const entries = await Promise.all(STORAGE_PROVIDERS.map(async (provider) => (
    [provider.id, await provider.exportData()] as const
  )));
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    providers: Object.fromEntries(entries) as Record<StorageProviderId, unknown>,
  };
}

export function parseNovaBackup(text: string): NovaBackup {
  const value: unknown = JSON.parse(text);
  if (isVersionTwoBackup(value)) return value;
  if (isVersionOneBackup(value)) return normalizeVersionOneBackup(value);
  throw new Error("备份文件格式无效");
}

const localEntryCount = (value: unknown) => {
  if (!isObject(value) || !isObject(value.localStorage)) return 0;
  return Object.keys(value.localStorage).length;
};

export function summarizeNovaBackup(backup: NovaBackup): NovaBackupSummary {
  const desktop = backup.providers.desktop;
  const reader = backup.providers.reader;
  const games = backup.providers.games;
  const magicTower = isObject(games) && Array.isArray(games.magicTower)
    ? games.magicTower.length
    : 0;
  return {
    exportedAt: backup.exportedAt,
    desktopItems: Array.isArray(desktop) ? desktop.length : 0,
    readerBooks: Array.isArray(reader) ? reader.length : 0,
    localSettings: STORAGE_PROVIDERS
      .filter((provider) => provider.id !== "desktop" && provider.id !== "reader")
      .reduce((total, provider) => total + localEntryCount(backup.providers[provider.id]), magicTower),
  };
}

export async function restoreNovaBackup(backup: NovaBackup) {
  await Promise.all(STORAGE_PROVIDERS.map((provider) => (
    provider.restoreData(backup.providers[provider.id])
  )));
}

export async function estimateNovaStorage() {
  const estimate = await navigator.storage?.estimate?.();
  return {
    usage: estimate?.usage ?? 0,
    quota: estimate?.quota ?? 0,
  };
}
