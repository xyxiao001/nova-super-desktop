export type BuiltInStorageProviderId =
  | "desktop"
  | "reader"
  | "calendar"
  | "games"
  | "reading"
  | "focus"
  | "settings"
  | "other";
export type StorageProviderId = string;

export type StorageStats = {
  entries: number;
  bytes: number;
};

export type StorageProvider = {
  id: StorageProviderId;
  label: string;
  displayOrder: number;
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

const encoder = new TextEncoder();

export const encodedSize = (value: unknown) =>
  encoder.encode(JSON.stringify(value)).byteLength;
