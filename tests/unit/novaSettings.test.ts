import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CALENDAR_ALMANAC_KEY,
  DEFAULT_SETTINGS,
  readCalendarAlmanacEnabled,
  saveCalendarAlmanacEnabled,
} from "../../app/novaSettings";

afterEach(() => vi.unstubAllGlobals());

describe("nova settings", () => {
  it("uses the NOVA wallpaper for existing installations without a saved choice", () => {
    expect(DEFAULT_SETTINGS.wallpaper).toBe("nova");
  });

  it("keeps the calendar almanac disabled until the user enables it", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => null });

    expect(readCalendarAlmanacEnabled()).toBe(false);
  });

  it("restores the saved calendar almanac choice", () => {
    let saved: string | null = null;
    vi.stubGlobal("localStorage", {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value; },
    });
    vi.stubGlobal("window", {});

    saveCalendarAlmanacEnabled(true);

    expect(saved).toBe("true");
    expect(readCalendarAlmanacEnabled()).toBe(true);
    expect(CALENDAR_ALMANAC_KEY).toBe("nova-calendar-almanac-enabled");
  });
});
