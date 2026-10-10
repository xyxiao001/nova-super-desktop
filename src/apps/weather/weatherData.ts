export type City = { id: number; name: string; latitude: number; longitude: number; timezone: string; country: string; admin1?: string };
export const WUHAN: City = { id: 1791247, name: "武汉", latitude: 30.58333, longitude: 114.26667, timezone: "Asia/Shanghai", country: "中国", admin1: "湖北" };
export type WeatherData = {
  timezone: string;
  current: { time: number; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; is_day: number; weather_code: number; wind_speed_10m: number };
  hourly: { is_day: number[]; time: number[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[] };
  daily: { time: number[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
};
export type WeatherKind = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm";
export const WEATHER_CODES: Record<number, { label: string; kind: WeatherKind }> = {
  0: { label: "晴", kind: "clear" }, 1: { label: "晴间多云", kind: "clear" }, 2: { label: "多云", kind: "cloudy" }, 3: { label: "阴", kind: "cloudy" },
  45: { label: "雾", kind: "fog" }, 48: { label: "雾凇", kind: "fog" },
  51: { label: "小毛毛雨", kind: "rain" }, 53: { label: "毛毛雨", kind: "rain" }, 55: { label: "强毛毛雨", kind: "rain" }, 56: { label: "冻毛毛雨", kind: "rain" }, 57: { label: "强冻毛毛雨", kind: "rain" },
  61: { label: "小雨", kind: "rain" }, 63: { label: "中雨", kind: "rain" }, 65: { label: "大雨", kind: "rain" }, 66: { label: "冻雨", kind: "rain" }, 67: { label: "强冻雨", kind: "rain" },
  71: { label: "小雪", kind: "snow" }, 73: { label: "中雪", kind: "snow" }, 75: { label: "大雪", kind: "snow" }, 77: { label: "雪粒", kind: "snow" },
  80: { label: "小阵雨", kind: "rain" }, 81: { label: "阵雨", kind: "rain" }, 82: { label: "强阵雨", kind: "rain" }, 85: { label: "阵雪", kind: "snow" }, 86: { label: "强阵雪", kind: "snow" },
  95: { label: "雷雨", kind: "storm" }, 96: { label: "雷雨伴冰雹", kind: "storm" }, 99: { label: "强雷雨伴冰雹", kind: "storm" },
};
export type WeatherLocation = Pick<City, "name" | "latitude" | "longitude" | "timezone">;
export function weatherUrl(city: WeatherLocation) {
  const params = new URLSearchParams({ latitude: String(city.latitude), longitude: String(city.longitude), timezone: city.timezone, timeformat: "unixtime", forecast_days: "7", current: "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m", hourly: "temperature_2m,precipitation_probability,weather_code,is_day", daily: "weather_code,temperature_2m_max,temperature_2m_min" });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}
export const formatWeatherTime = (seconds: number, timezone: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(seconds * 1000);
export function upcomingHours(data: WeatherData) {
  return data.hourly.time.map((time, index) => ({ time, isDay: data.hourly.is_day[index], temperature: data.hourly.temperature_2m[index], rain: data.hourly.precipitation_probability[index], code: data.hourly.weather_code[index] }))
    .filter(hour => hour.time >= data.current.time).slice(0, 12);
}
