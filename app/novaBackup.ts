import {
  localStorageCategory,
} from "../src/platform/storage/providers/localSettings";
import type { GameStorageProviderData } from "../src/apps/games/storageProvider";
import {
  getStorageProviders,
} from "../src/platform/storage/providers/registry";
import type {
  LocalStorageProviderData,
  StorageProvider,
  StorageProviderId,
} from "../src/platform/storage/providers/types";

const BACKUP_VERSION = 3;
const PREVIOUS_BACKUP_VERSION = 2;
const LEGACY_BACKUP_VERSION = 1;
const LEGACY_KEYS = new Set(["nova-desktop-items", "nova-reader-downloads"]);
const VERSION_TWO_PROVIDER_IDS = [
  "desktop",
  "reader",
  "games",
  "reading",
  "focus",
  "settings",
  "other",
] as const satisfies readonly StorageProviderId[];

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

type NovaBackupV2 = {
  version: typeof PREVIOUS_BACKUP_VERSION;
  exportedAt: string;
  providers: Record<typeof VERSION_TWO_PROVIDER_IDS[number], unknown>;
};

export type NovaBackupSummary = {
  exportedAt: string;
  desktopItems: number;
  readerBooks: number;
  calendarEvents: number;
  localSettings: number;
};

const isObject = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === "object" && !Array.isArray(value)
);

const hasValidExportDate = (value: Record<string, unknown>) => (
  typeof value.exportedAt === "string"
  && Number.isFinite(Date.parse(value.exportedAt))
);

const isCurrentBackup = (
  value: unknown,
  providerDefinitions: readonly StorageProvider[],
): value is NovaBackup => {
  if (!isObject(value) || value.version !== BACKUP_VERSION || !hasValidExportDate(value)) return false;
  const providerData = value.providers;
  if (!isObject(providerData)) return false;
  const providerIds = providerDefinitions.map((provider) => provider.id);
  if (
    Object.keys(providerData).length !== providerIds.length
    || !providerIds.every((id) => id in providerData)
  ) return false;
  return providerDefinitions.every((provider) =>
    provider.validateData(providerData[provider.id])
  );
};

const isVersionTwoBackup = (
  value: unknown,
  providerById: Record<StorageProviderId, StorageProvider>,
): value is NovaBackupV2 => {
  if (!isObject(value) || value.version !== PREVIOUS_BACKUP_VERSION || !hasValidExportDate(value)) return false;
  const providers = value.providers;
  if (!isObject(providers)) return false;
  if (
    Object.keys(providers).length !== VERSION_TWO_PROVIDER_IDS.length
    || !VERSION_TWO_PROVIDER_IDS.every((id) => id in providers)
  ) return false;
  return VERSION_TWO_PROVIDER_IDS.every((id) => providerById[id].validateData(providers[id]));
};

const isVersionOneBackup = (
  value: unknown,
  providerById: Record<StorageProviderId, StorageProvider>,
): value is NovaBackupV1 => {
  if (!isObject(value) || value.version !== LEGACY_BACKUP_VERSION || !hasValidExportDate(value)) return false;
  if (!providerById.desktop.validateData(value.desktopItems)) return false;
  if (!providerById.reader.validateData(value.readerBooks)) return false;
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
    calendar: [],
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

const normalizeVersionTwoBackup = (backup: NovaBackupV2): NovaBackup => ({
  version: BACKUP_VERSION,
  exportedAt: backup.exportedAt,
  providers: {
    ...backup.providers,
    calendar: [],
  },
});

export async function createNovaBackup(): Promise<NovaBackup> {
  const providers = await getStorageProviders();
  const entries = await Promise.all(providers.map(async (provider) => (
    [provider.id, await provider.exportData()] as const
  )));
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    providers: Object.fromEntries(entries) as Record<StorageProviderId, unknown>,
  };
}

export async function parseNovaBackup(text: string): Promise<NovaBackup> {
  const storageProviders = await getStorageProviders();
  const providerById = Object.fromEntries(
    storageProviders.map((provider) => [provider.id, provider]),
  ) as Record<StorageProviderId, StorageProvider>;
  const value: unknown = JSON.parse(text);
  if (isCurrentBackup(value, storageProviders)) return value;
  if (isVersionTwoBackup(value, providerById)) return normalizeVersionTwoBackup(value);
  if (isVersionOneBackup(value, providerById)) return normalizeVersionOneBackup(value);
  throw new Error("备份文件格式无效");
}

const localEntryCount = (value: unknown) => {
  if (!isObject(value) || !isObject(value.localStorage)) return 0;
  return Object.keys(value.localStorage).length;
};

export function summarizeNovaBackup(backup: NovaBackup): NovaBackupSummary {
  const desktop = backup.providers.desktop;
  const reader = backup.providers.reader;
  const calendar = backup.providers.calendar;
  const games = backup.providers.games;
  const magicTower = isObject(games) && Array.isArray(games.magicTower)
    ? games.magicTower.length
    : 0;
  return {
    exportedAt: backup.exportedAt,
    desktopItems: Array.isArray(desktop) ? desktop.length : 0,
    readerBooks: Array.isArray(reader) ? reader.length : 0,
    calendarEvents: Array.isArray(calendar) ? calendar.length : 0,
    localSettings: Object.entries(backup.providers)
      .filter(([id]) => !["desktop", "reader", "calendar"].includes(id))
      .reduce((total, [, data]) => total + localEntryCount(data), magicTower),
  };
}

export async function restoreNovaBackup(backup: NovaBackup) {
  const providers = await getStorageProviders();
  await Promise.all(providers.map((provider) => (
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
