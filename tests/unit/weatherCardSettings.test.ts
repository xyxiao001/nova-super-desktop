import { afterEach, describe, expect, it, vi } from "vitest";
import { currentWeatherLocation, readWeatherCardSettings, saveWeatherCardSettings } from "../../src/apps/weather/weatherCardSettings";
import { WEATHER_CARD_STORAGE_KEY } from "../../src/platform/desktop/widgetSettings";
import { clearLocalStorageCategory } from "../../src/platform/storage/providers/localSettings";

afterEach(() => vi.unstubAllGlobals());

describe("standalone desktop weather", () => {
  it("restores the chosen city and placement and clears them with desktop settings", () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return entries.size; },
      key: (index: number) => [...entries.keys()][index],
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    });
    expect(readWeatherCardSettings()).toEqual({ location: null, position: null });
    const settings = { location: { name: "杭州", latitude: 30.2741, longitude: 120.1551, timezone: "Asia/Shanghai" }, position: { x: 310, y: 170 } };
    saveWeatherCardSettings(settings);
    expect(readWeatherCardSettings()).toEqual(settings);
    clearLocalStorageCategory("settings");
    expect(localStorage.getItem(WEATHER_CARD_STORAGE_KEY)).toBeNull();
  });

  it("uses the requested coordinates without substituting a default city", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: 30.27, longitude: 120.15 } } as GeolocationPosition));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    await expect(currentWeatherLocation()).resolves.toEqual({ name: "当前位置", latitude: 30.27, longitude: 120.15, timezone: "auto" });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("propagates a denied location permission without retrying or selecting another place", async () => {
    const denial = { code: 1, message: "Permission denied" };
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => error(denial as GeolocationPositionError));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    await expect(currentWeatherLocation()).rejects.toBe(denial);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
