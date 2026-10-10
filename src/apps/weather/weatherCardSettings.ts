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

export async function resolveWeatherLocation(location: WeatherLocation, signal?: AbortSignal): Promise<WeatherLocation> {
  const params = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), limit: "1", radius: "50" });
  params.append("layer", "city");
  params.append("layer", "district");
  const response = await fetch(`https://photon.komoot.io/reverse?${params}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: { features: { properties: { name: string; city?: string } }[] } = await response.json();
  const place = data.features[0].properties;
  const name = [...new Set([place.city, place.name].filter(Boolean))].join(" · ");
  return { ...location, name, placeSource: "photon" };
}

export async function currentWeatherLocation(signal?: AbortSignal): Promise<WeatherLocation> {
  const location = await new Promise<WeatherLocation>((resolve, reject) => navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ name: "当前位置", latitude: coords.latitude, longitude: coords.longitude, timezone: "auto" }),
    reject,
  ));
  return resolveWeatherLocation(location, signal);
}
