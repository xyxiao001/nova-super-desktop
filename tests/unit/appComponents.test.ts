import { describe, expect, it } from "vitest";

import {
  APP_COMPONENTS,
  appModuleLoaders,
} from "../../src/platform/apps/appRegistry";

describe("app component registry", () => {
  it("exposes independent module loaders", () => {
    expect(Object.keys(appModuleLoaders).length).toBeGreaterThan(0);
    expect(Object.values(appModuleLoaders).every((loader) => typeof loader === "function")).toBe(true);
  });

  it("derives every lazy component without named exports", () => {
    expect(Object.keys(APP_COMPONENTS)).toEqual(Object.keys(appModuleLoaders));
  });
});
