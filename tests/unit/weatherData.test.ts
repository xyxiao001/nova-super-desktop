import { describe, expect, it } from "vitest";
import { formatWeatherTime, upcomingHours, type WeatherData } from "../../src/apps/weather/weatherData";
import { dailyArtworkIndex, GALLERY_WORKS } from "../../src/apps/gallery/galleryData";

describe("weather presentation", () => {
  it("shows twelve upcoming hours, keeping values aligned across midnight", () => {
    const start = Date.UTC(2026, 9, 10, 14) / 1000;
    const data = {
      current: { time: start + 900 },
      hourly: {
        is_day: Array(24).fill(0),
        time: Array.from({ length: 24 }, (_, i) => start + i * 3600),
        temperature_2m: Array.from({ length: 24 }, (_, i) => 20 + i),
        precipitation_probability: Array.from({ length: 24 }, (_, i) => i * 2),
        weather_code: Array(24).fill(2),
      },
    } as WeatherData;
    const hours = upcomingHours(data);
    expect(hours).toHaveLength(12);
    expect(hours[0]).toEqual({ time: start + 3600, isDay: 0, temperature: 21, rain: 2, code: 2 });
    expect(formatWeatherTime(hours[1].time, "Asia/Shanghai")).toBe("00:00");
    expect(hours[11].temperature).toBe(32);
  });

  it("formats the selected city's time independently of the device timezone", () => {
    const time = Date.UTC(2026, 9, 10, 15, 30) / 1000;
    expect(formatWeatherTime(time, "Asia/Shanghai")).toBe("23:30");
    expect(formatWeatherTime(time, "Europe/London")).toBe("16:30");
  });
});

describe("daily gallery selection", () => {
  it("keeps the same work throughout a local day and advances on the next day", () => {
    const morning = new Date(2026, 9, 10, 0, 1);
    const night = new Date(2026, 9, 10, 23, 59);
    const tomorrow = new Date(2026, 9, 11, 0, 1);
    expect(dailyArtworkIndex(morning)).toBe(dailyArtworkIndex(night));
    expect(dailyArtworkIndex(tomorrow)).toBe((dailyArtworkIndex(morning) + 1) % GALLERY_WORKS.length);
  });
});
