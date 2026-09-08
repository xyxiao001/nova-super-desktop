import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CALENDAR_ALMANAC_KEY,
  DEFAULT_SETTINGS,
  readNovaSettings,
  saveNovaSettings,
  readCalendarAlmanacEnabled,
  saveCalendarAlmanacEnabled,
} from "../../app/novaSettings";

afterEach(() => vi.unstubAllGlobals());

describe("nova settings", () => {
  it("persists scene themes independently of desktop interaction style and wallpaper", () => {
    let saved = JSON.stringify({ ...DEFAULT_SETTINGS, desktopStyle: "future", wallpaper: "dawn" });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("localStorage", {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value; },
    });
    for (const desktopLook of ["retro", "cartoon", "paper", "original"] as const) {
      saveNovaSettings({ ...readNovaSettings(), desktopLook });
      expect(readNovaSettings()).toEqual({ ...DEFAULT_SETTINGS, desktopLook, desktopStyle: "future", wallpaper: "dawn" });
    }
  });

  it("keeps existing settings on the classic desktop", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ theme: "dark", wallpaper: "grove", sound: false, volume: .2 }) });
    expect(readNovaSettings()).toEqual({ desktopLook: "original", desktopStyle: "classic", theme: "dark", wallpaper: "grove", sound: false, volume: .2 });
  });

  it("saves and restores either desktop style without changing other preferences", () => {
    let saved = JSON.stringify({ ...DEFAULT_SETTINGS, wallpaper: "grove", sound: false });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("localStorage", {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value; },
    });
    for (const desktopStyle of ["future", "classic"] as const) {
      saveNovaSettings({ ...readNovaSettings(), desktopStyle });
      expect(readNovaSettings()).toEqual({ ...DEFAULT_SETTINGS, desktopStyle, wallpaper: "grove", sound: false });
    }
  });

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
