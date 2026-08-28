import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { APP_MANIFESTS, RESOURCE_PACKAGE_MANIFESTS } from "../../app/appManifest";
import {
  serializeServiceWorkerResourcePackages,
  serviceWorkerResourcePackages,
} from "../../app/resourcePackageManifest";

describe("resource package manifest", () => {
  it("keeps every application package reference in the package manifest", () => {
    const packageIds = new Set(RESOURCE_PACKAGE_MANIFESTS.map((item) => item.id));
    const referencedIds = Object.values(APP_MANIFESTS).flatMap((item) => (
      "resourcePackageIds" in item ? item.resourcePackageIds : []
    ));

    expect(referencedIds.every((id) => packageIds.has(id))).toBe(true);
  });

  it("preserves the service worker resource match order", () => {
    expect(serviceWorkerResourcePackages().map((item) => item.id)).toEqual([
      "magic-tower",
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
