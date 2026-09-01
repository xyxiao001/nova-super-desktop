import { RESOURCE_PACKAGE_MANIFESTS } from "../src/platform/apps/appManifest.ts";

export type ServiceWorkerResourcePackage = {
  id: string;
  pathPrefixes: readonly string[];
  exactPaths: readonly string[];
  destinations: readonly string[];
  extensions: readonly string[];
};

export const serviceWorkerResourcePackages = (): ServiceWorkerResourcePackage[] => RESOURCE_PACKAGE_MANIFESTS
  .filter((item) => item.id !== "system")
  .sort((left, right) => (left.matchPriority ?? 0) - (right.matchPriority ?? 0))
  .map((item) => ({
    id: item.id,
    pathPrefixes: item.pathPrefixes ?? [],
    exactPaths: item.exactPaths ?? [],
    destinations: item.destinations ?? [],
    extensions: item.extensions ?? [],
  }));

export const serializeServiceWorkerResourcePackages = () => (
  `self.NOVA_RESOURCE_PACKAGES = ${JSON.stringify(serviceWorkerResourcePackages(), null, 2)};\n`
);
