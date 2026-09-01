import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { APP_MANIFESTS, RESOURCE_PACKAGE_MANIFESTS } from "../../src/platform/apps/appManifest";
import {
  serializeServiceWorkerResourcePackages,
  serviceWorkerResourcePackages,
} from "../../app/resourcePackageManifest";

describe("resource package manifest", () => {
  it("derives application packages from application manifests", () => {
    const packageIds = new Set(RESOURCE_PACKAGE_MANIFESTS.map((item) => item.id));
    const referencedIds = Object.values(APP_MANIFESTS).flatMap((item) => (
      "resourcePackages" in item ? item.resourcePackages.map((resource) => resource.id) : []
    ));

    expect(referencedIds.every((id) => packageIds.has(id))).toBe(true);
  });

  it("preserves the service worker resource match order", () => {
    expect(serviceWorkerResourcePackages().map((item) => item.id)).toEqual([
      "magic-tower",
      "youtd2",
      "chess-engine",
      "books",
      "photos",
      "apps",
      "media",
    ]);
  });

  it("keeps the generated service worker configuration current", async () => {
    const generated = await readFile(
      new URL("../../public/resource-packages.generated.js", import.meta.url),
      "utf8",
    );

    expect(generated).toBe(serializeServiceWorkerResourcePackages());
  });
});
