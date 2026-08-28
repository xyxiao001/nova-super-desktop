import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const resourcePackages = readFileSync(
  new URL("../../public/resource-packages.generated.js", import.meta.url),
  "utf8",
);

describe("service worker resource policy", () => {
  it("keeps the install shell minimal and avoids recursive chunk discovery", () => {
    expect(source).toContain('const VERSION = "nova-pwa-v6"');
    expect(source).not.toContain("BUILD_ASSET_PATTERN");
    expect(source).not.toContain("while (pending.length)");
  });

  it("keeps large features in independent on-demand caches", () => {
    expect(source).toContain('importScripts("/resource-packages.generated.js")');
    expect(resourcePackages).toContain('"id": "magic-tower"');
    expect(resourcePackages).toContain('"id": "chess-engine"');
    expect(resourcePackages).toContain('"id": "books"');
    expect(resourcePackages).toContain('"id": "photos"');
    expect(resourcePackages).toContain('"id": "apps"');
    expect(source).toContain("GET_RESOURCE_CACHE_STATUS");
    expect(source).toContain("CLEAR_RESOURCE_CACHE");
    expect(source).toContain("CLEAR_ALL_RESOURCE_CACHES");
  });
});
