import { describe, expect, it } from "vitest";

import {
  DESKTOP_PET_HORIZONTAL_INSET,
  clampDesktopPetX,
} from "../../app/petPosition";

describe("desktop pet position", () => {
  it("uses the rendered pet width instead of a fixed viewport percentage", () => {
    const width = 1_000;

    expect(clampDesktopPetX(0, width)).toBe(
      DESKTOP_PET_HORIZONTAL_INSET / width,
    );
    expect(clampDesktopPetX(1, width)).toBe(
      1 - DESKTOP_PET_HORIZONTAL_INSET / width,
    );
  });

  it("keeps the full pet visible in narrow containers", () => {
    expect(clampDesktopPetX(0, 80)).toBe(0.5);
    expect(clampDesktopPetX(1, 80)).toBe(0.5);
  });

  it("preserves positions that are already inside the usable range", () => {
    expect(clampDesktopPetX(0.82, 1_000)).toBe(0.82);
  });
});
