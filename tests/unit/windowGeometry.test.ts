import { describe, expect, it } from "vitest";

import {
  canMeasureWindowGeometry,
  edgeSnapMode,
  snappedWindowGeometry,
  windowShortcutAction,
} from "../../app/windowGeometry";

describe("canMeasureWindowGeometry", () => {
  it("ignores hidden window dimensions while minimized", () => {
    expect(canMeasureWindowGeometry(true, false, 0, 0)).toBe(false);
    expect(canMeasureWindowGeometry(false, false, 0, 0)).toBe(false);
    expect(canMeasureWindowGeometry(false, true, 820, 600)).toBe(false);
    expect(canMeasureWindowGeometry(false, false, 820, 600)).toBe(true);
  });
});

describe("snappedWindowGeometry", () => {
  it("creates non-overlapping left and right halves", () => {
    const left = snappedWindowGeometry("left", 1200, 800);
    const right = snappedWindowGeometry("right", 1200, 800);

    expect(left).toEqual({ x: 0, y: 0, width: 598, height: 747 });
    expect(right).toEqual({ x: 602, y: 0, width: 598, height: 747 });
    expect(left.x + left.width).toBeLessThan(right.x);
  });

  it("creates four stable quadrants", () => {
    expect(snappedWindowGeometry("top-left", 1200, 800)).toEqual({
      x: 0,
      y: 0,
      width: 598,
      height: 371,
    });
    expect(snappedWindowGeometry("bottom-right", 1200, 800)).toEqual({
      x: 602,
      y: 376,
      width: 598,
      height: 371,
    });
  });
});

describe("windowShortcutAction", () => {
  it("moves a half-screen window into the corresponding quadrant", () => {
    expect(windowShortcutAction("left", false, "ArrowUp")).toBe("top-left");
    expect(windowShortcutAction("right", false, "ArrowDown")).toBe("bottom-right");
  });

  it("restores a maximized window before minimizing it", () => {
    expect(windowShortcutAction(undefined, true, "ArrowDown")).toBe("restore");
    expect(windowShortcutAction(undefined, false, "ArrowDown")).toBe("minimize");
  });
});

describe("edgeSnapMode", () => {
  it("prioritizes corner quadrants over side halves", () => {
    expect(edgeSnapMode(0, 20, 1200, 800)).toBe("top-left");
    expect(edgeSnapMode(1200, 790, 1200, 800)).toBe("bottom-right");
  });

  it("maps top and side edges while ignoring the center", () => {
    expect(edgeSnapMode(600, 0, 1200, 800)).toBe("maximize");
    expect(edgeSnapMode(0, 400, 1200, 800)).toBe("left");
    expect(edgeSnapMode(600, 400, 1200, 800)).toBeNull();
  });
});
