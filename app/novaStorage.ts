import {
  STORAGE_PROVIDER_BY_ID,
  STORAGE_PROVIDERS,
  type StorageProviderId,
} from "./storageProviders";

export type NovaStorageCategoryId = StorageProviderId;

export type NovaStorageCategory = {
  id: NovaStorageCategoryId;
  label: string;
  description: string;
  entries: number;
  bytes: number;
  canClear: boolean;
};

export async function inspectNovaStorage(): Promise<NovaStorageCategory[]> {
  const categories = await Promise.all(STORAGE_PROVIDERS.map(async (provider) => {
    const stats = await provider.inspect();
    return {
      id: provider.id,
      label: provider.label,
      description: provider.description(stats),
      entries: stats.entries,
      bytes: stats.bytes,
      canClear: stats.entries > 0,
      showWhenEmpty: provider.showWhenEmpty,
    };
  }));

  return categories
    .filter((category) => category.showWhenEmpty || category.entries > 0)
    .map(({ id, label, description, entries, bytes, canClear }) => ({
      id,
      label,
      description,
      entries,
      bytes,
      canClear,
    }));
}

export async function clearNovaStorageCategory(id: NovaStorageCategoryId) {
  await STORAGE_PROVIDER_BY_ID[id].clear();
}

export async function clearAllNovaStorage() {
  await Promise.all(STORAGE_PROVIDERS.map((provider) => provider.clear()));
}
