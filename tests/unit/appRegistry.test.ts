import { describe, expect, it } from "vitest";
import {
  APP_COMPONENTS,
  APP_REGISTRY,
  LAUNCHER_APPS,
  REGISTERED_APPS,
  appModuleLoaders,
  START_APP_GROUPS,
  START_PINNED_APPS,
} from "../../src/platform/apps/appRegistry";
import { GAME_CATALOG } from "../../src/apps/games/entry";

describe("appRegistry", () => {
  it("keeps registered application ids unique and addressable", () => {
    const ids = REGISTERED_APPS.map((app) => app.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => APP_REGISTRY[id].id === id)).toBe(true);
  });

  it("keeps the application registry and lazy loaders in sync", () => {
    expect(Object.keys(appModuleLoaders).sort()).toEqual(
      Object.keys(APP_REGISTRY).sort(),
    );
  });

  it("defines a compact pinned page and groups every launcher app", () => {
    const groupIds = new Set(START_APP_GROUPS.map((group) => group.id));

    expect(START_PINNED_APPS).toHaveLength(8);
    expect(START_PINNED_APPS.every((app) => app.launcher)).toBe(true);
    expect(LAUNCHER_APPS.every((app) => app.startGroup && groupIds.has(app.startGroup))).toBe(true);
    expect(APP_REGISTRY.calendar).toMatchObject({
      label: "日历",
      launcher: true,
      startGroup: "productivity",
    });
  });

  it("registers every catalog game as a non-launcher window", () => {
    expect(LAUNCHER_APPS.some((app) => app.id === "games")).toBe(true);
    expect(GAME_CATALOG.every((game) => APP_REGISTRY[game.id])).toBe(true);
    expect(GAME_CATALOG.every((game) => !APP_REGISTRY[game.id].launcher)).toBe(true);
    expect(Object.keys(APP_REGISTRY)).not.toEqual(expect.arrayContaining(["go", "sudoku", "voyage"]));
  });

  it("derives every hosted component from the manifest", () => {
    expect(Object.keys(APP_COMPONENTS)).toEqual(
      REGISTERED_APPS.map((app) => app.id),
    );
  });

  it("defines window behavior for every registered application", () => {
    expect(REGISTERED_APPS.every((app) => app.window.mobile === "fullscreen")).toBe(true);
    expect(APP_REGISTRY.calendar.window).toMatchObject({
      size: "wide",
      minWidth: 700,
      minHeight: 520,
    });
  });
});
