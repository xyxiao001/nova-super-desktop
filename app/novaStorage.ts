import {
  getStorageProviderById,
  getStorageProviders,
} from "../src/platform/storage/providers/registry";
import {
  type StorageProviderId,
} from "../src/platform/storage/providers/types";

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
  const providers = await getStorageProviders();
  const categories = await Promise.all(providers.map(async (provider) => {
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
  await (await getStorageProviderById(id)).clear();
}

export async function clearAllNovaStorage() {
  const providers = await getStorageProviders();
  await Promise.all(providers.map((provider) => provider.clear()));
}
