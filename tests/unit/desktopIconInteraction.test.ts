import { describe, expect, it } from "vitest";

import {
  COMPACT_DESKTOP_QUERY,
  DESKTOP_ICON_LONG_PRESS_MS,
  desktopIconClickAction,
  isMobileSearchPull,
  movedBeyondLongPressTolerance,
} from "../../app/desktopIconInteraction";

describe("desktop icon interaction", () => {
  it("opens an icon with one tap only on compact viewports", () => {
    expect(COMPACT_DESKTOP_QUERY).toContain("(pointer: coarse)");
    expect(desktopIconClickAction(true, false, false, "select")).toBe("open");
    expect(desktopIconClickAction(false, false, false, "select")).toBe("select");
    expect(desktopIconClickAction(false, false, false, "ignore")).toBe("ignore");
  });

  it("suppresses clicks after a long press or pointer movement", () => {
    expect(desktopIconClickAction(true, true, false, "select")).toBe("ignore");
    expect(desktopIconClickAction(true, false, true, "select")).toBe("ignore");
  });

  it("allows small finger drift without cancelling a long press", () => {
    expect(DESKTOP_ICON_LONG_PRESS_MS).toBeGreaterThanOrEqual(450);
    expect(movedBeyondLongPressTolerance({ x: 10, y: 10 }, { x: 16, y: 16 })).toBe(false);
    expect(movedBeyondLongPressTolerance({ x: 10, y: 10 }, { x: 22, y: 10 })).toBe(true);
  });

  it("recognizes a deliberate downward search gesture", () => {
    expect(isMobileSearchPull({ x: 100, y: 120 }, { x: 108, y: 190 })).toBe(true);
    expect(isMobileSearchPull({ x: 100, y: 120 }, { x: 150, y: 170 })).toBe(false);
    expect(isMobileSearchPull({ x: 100, y: 120 }, { x: 104, y: 165 })).toBe(false);
  });
});
