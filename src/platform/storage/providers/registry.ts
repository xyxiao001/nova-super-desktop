import {
  APP_MANIFESTS,
  type AppManifestEntry,
} from "../../apps/appManifest";
import desktopProvider from "./desktop";
import { OTHER_STORAGE_PROVIDER } from "./localSettings";
import type { StorageProvider, StorageProviderId } from "./types";

let providersPromise: Promise<readonly StorageProvider[]> | null = null;

export const getStorageProviders = () => {
  if (!providersPromise) {
    const loaders = Object.values(APP_MANIFESTS).flatMap<
      () => Promise<{ default: StorageProvider }>
    >((app) => {
      const providers = (app as AppManifestEntry).storageProviders;
      return providers ? [...providers] : [];
    });
    providersPromise = Promise.all(loaders.map((load) => load())).then((modules) => {
      const providers = [
        desktopProvider,
        ...modules.map((module) => module.default),
        OTHER_STORAGE_PROVIDER,
      ].sort((left, right) => left.displayOrder - right.displayOrder);
      const ids = new Set<StorageProviderId>();
      for (const provider of providers) {
        if (ids.has(provider.id)) {
          throw new Error(`Duplicate storage provider: ${provider.id}`);
        }
        ids.add(provider.id);
      }
      return providers;
    });
  }
  return providersPromise;
};

export const getStorageProviderById = async (id: StorageProviderId) => {
  const provider = (await getStorageProviders()).find((item) => item.id === id);
  if (!provider) throw new Error(`Unknown storage provider: ${id}`);
  return provider;
};
