import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../app/novaSettings";

describe("nova settings", () => {
  it("uses the NOVA wallpaper for existing installations without a saved choice", () => {
    expect(DEFAULT_SETTINGS.wallpaper).toBe("nova");
  });
});
