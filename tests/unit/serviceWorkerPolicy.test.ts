import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);

describe("service worker resource policy", () => {
  it("keeps the install shell minimal and avoids recursive chunk discovery", () => {
    expect(source).toContain('const VERSION = "nova-pwa-v4"');
    expect(source).not.toContain("BUILD_ASSET_PATTERN");
    expect(source).not.toContain("while (pending.length)");
  });

  it("keeps large features in independent on-demand caches", () => {
    expect(source).toContain('id: "magic-tower"');
    expect(source).toContain('id: "chess-engine"');
    expect(source).toContain('id: "books"');
    expect(source).toContain('id: "photos"');
    expect(source).toContain('id: "apps"');
    expect(source).toContain("GET_RESOURCE_CACHE_STATUS");
    expect(source).toContain("CLEAR_RESOURCE_CACHE");
  });
});
