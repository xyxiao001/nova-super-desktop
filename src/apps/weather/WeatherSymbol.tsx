import type { WeatherKind } from "./weatherData";

export default function WeatherSymbol({ kind, night = false }: { kind: WeatherKind; night?: boolean }) {
  return <span className={`weather-symbol kind-${kind} ${night ? "is-night" : ""}`} aria-hidden="true"><i className="weather-sun" /><i className="weather-cloud" /><i className="weather-drops" /></span>;
}
