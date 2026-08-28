import { describe, expect, it } from "vitest";

import { appModuleLoaders } from "../../app/lazyApps";

describe("lazy app registry", () => {
  it("registers every window application as an independent loader", () => {
    expect(Object.keys(appModuleLoaders).sort()).toEqual([
      "calculator",
      "chess",
      "drawing",
      "explorer",
      "focus",
      "folder",
      "games",
      "go",
      "gomoku",
      "mines",
      "notes",
      "photo",
      "reader",
      "recycle",
      "settings",
      "sudoku",
      "viewer",
      "voyage",
    ]);
    expect(Object.values(appModuleLoaders).every((loader) => typeof loader === "function")).toBe(true);
  });
});
