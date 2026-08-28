import { describe, expect, it } from "vitest";

import { appModuleLoaders } from "../../app/lazyApps";

describe("lazy app registry", () => {
  it("exposes independent module loaders", () => {
    expect(Object.keys(appModuleLoaders).length).toBeGreaterThan(0);
    expect(Object.values(appModuleLoaders).every((loader) => typeof loader === "function")).toBe(true);
  });
});
