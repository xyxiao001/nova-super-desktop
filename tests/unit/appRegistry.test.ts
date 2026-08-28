import { describe, expect, it } from "vitest";
import {
  APP_REGISTRY,
  LAUNCHER_APPS,
  REGISTERED_APPS,
  START_APP_GROUPS,
  START_PINNED_APPS,
} from "../../app/appRegistry";

describe("appRegistry", () => {
  it("keeps registered application ids unique and addressable", () => {
    const ids = REGISTERED_APPS.map((app) => app.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => APP_REGISTRY[id].id === id)).toBe(true);
  });

  it("defines a compact pinned page and groups every launcher app", () => {
    const groupIds = new Set(START_APP_GROUPS.map((group) => group.id));

    expect(START_PINNED_APPS).toHaveLength(8);
    expect(START_PINNED_APPS.every((app) => app.launcher)).toBe(true);
    expect(LAUNCHER_APPS.every((app) => app.startGroup && groupIds.has(app.startGroup))).toBe(true);
  });

  it("keeps non-launcher game windows out of the all-apps list", () => {
    expect(LAUNCHER_APPS.some((app) => app.id === "games")).toBe(true);
    expect(LAUNCHER_APPS.some((app) => app.id === "mines")).toBe(false);
    expect(LAUNCHER_APPS.some((app) => app.id === "tower")).toBe(false);
  });
});
