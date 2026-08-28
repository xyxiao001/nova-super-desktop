import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearResourceCache,
  inspectResourceCaches,
} from "../../app/resourceCache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resource cache client", () => {
  it("returns the package catalog when no service worker is available", async () => {
    vi.stubGlobal("navigator", {});

    const packages = await inspectResourceCaches();

    expect(packages.map((item) => item.id)).toEqual([
      "system",
      "apps",
      "photos",
      "books",
      "chess-engine",
      "magic-tower",
      "media",
    ]);
    expect(packages.every((item) => item.entries === 0 && item.bytes === 0)).toBe(true);
  });

  it("does not report a successful deletion without a service worker", async () => {
    vi.stubGlobal("navigator", {});

    await expect(clearResourceCache("apps")).rejects.toThrow(
      "Service Worker 尚未接管页面",
    );
  });
});
