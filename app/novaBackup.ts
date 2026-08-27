import type { StoredBook } from "./readerCore";
import type { DesktopItem } from "./desktopFiles";
import { loadDesktopItems, replaceDesktopItems } from "./desktopStorage";
import { getAllStoredBooks, replaceStoredBooks } from "./readerStorage";

const BACKUP_VERSION = 1;
const LEGACY_KEYS = new Set(["nova-desktop-items", "nova-reader-downloads"]);

export type NovaBackup = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  desktopItems: DesktopItem[];
  readerBooks: StoredBook[];
  localStorage: Record<string, string>;
};

export type NovaBackupSummary = {
  exportedAt: string;
  desktopItems: number;
  readerBooks: number;
  localSettings: number;
};

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

const readNovaLocalStorage = () => {
  const values: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith("nova-") || LEGACY_KEYS.has(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return values;
};

export async function createNovaBackup(): Promise<NovaBackup> {
  const [desktopItems, readerBooks] = await Promise.all([
    loadDesktopItems(),
    getAllStoredBooks(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    desktopItems,
    readerBooks,
    localStorage: readNovaLocalStorage(),
  };
}

export function parseNovaBackup(text: string): NovaBackup {
  const value = JSON.parse(text) as Partial<NovaBackup>;
  if (
    value.version !== BACKUP_VERSION
    || typeof value.exportedAt !== "string"
    || !Number.isFinite(Date.parse(value.exportedAt))
    || !Array.isArray(value.desktopItems)
    || !value.desktopItems.every(isDesktopItem)
    || !Array.isArray(value.readerBooks)
    || !value.readerBooks.every(isStoredBook)
    || !value.localStorage
    || typeof value.localStorage !== "object"
    || Array.isArray(value.localStorage)
    || !Object.entries(value.localStorage).every(([key, entry]) => (
      key.startsWith("nova-")
      && !LEGACY_KEYS.has(key)
      && typeof entry === "string"
    ))
  ) {
    throw new Error("备份文件格式无效");
  }
  return value as NovaBackup;
}

export function summarizeNovaBackup(backup: NovaBackup): NovaBackupSummary {
  return {
    exportedAt: backup.exportedAt,
    desktopItems: backup.desktopItems.length,
    readerBooks: backup.readerBooks.length,
    localSettings: Object.keys(backup.localStorage).length,
  };
}

export async function restoreNovaBackup(backup: NovaBackup) {
  await Promise.all([
    replaceDesktopItems(backup.desktopItems),
    replaceStoredBooks(backup.readerBooks),
  ]);
  const currentKeys = Array.from(
    { length: localStorage.length },
    (_, index) => localStorage.key(index),
  ).filter((key): key is string => !!key && key.startsWith("nova-"));
  for (const key of currentKeys) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(backup.localStorage)) {
    localStorage.setItem(key, value);
  }
}

export async function estimateNovaStorage() {
  const estimate = await navigator.storage?.estimate?.();
  return {
    usage: estimate?.usage ?? 0,
    quota: estimate?.quota ?? 0,
  };
}
