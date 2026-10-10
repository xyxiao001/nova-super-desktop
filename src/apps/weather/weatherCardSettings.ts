import { WEATHER_CARD_STORAGE_KEY } from "../../platform/desktop/widgetSettings";
import type { WeatherLocation } from "./weatherData";

export type WeatherCardSettings = {
  location: WeatherLocation | null;
  position: { x: number; y: number } | null;
};

export function readWeatherCardSettings(): WeatherCardSettings {
  const saved = localStorage.getItem(WEATHER_CARD_STORAGE_KEY);
  return saved === null ? { location: null, position: null } : JSON.parse(saved);
}

export function saveWeatherCardSettings(settings: WeatherCardSettings) {
  localStorage.setItem(WEATHER_CARD_STORAGE_KEY, JSON.stringify(settings));
}

export function currentWeatherLocation(): Promise<WeatherLocation> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ name: "当前位置", latitude: coords.latitude, longitude: coords.longitude, timezone: "auto" }),
    reject,
  ));
}
