import { useEffect, useRef, useState, type FormEvent } from "react";
import type { City } from "./weatherData";

export default function CitySearch({ onSelect }: { onSelect: (city: City) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading"); setResults([]);
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: "6", language: "zh", format: "json" })}`, { signal: controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const data: { results?: City[] } = await response.json();
      // The service omits results when no locations match.
      setResults(data.results === undefined ? [] : data.results);
      setStatus("ready");
    } catch { if (!controller.signal.aborted) setStatus("error"); }
  };
  return <div className="weather-city-search">
    <form onSubmit={search}><label><span aria-hidden="true">⌕</span><input aria-label="搜索天气城市" placeholder="搜索城市 / City" value={query} onChange={event => setQuery(event.target.value)} /></label><button type="submit">查找</button></form>
    {status === "loading" && <p role="status">正在查找城市…</p>}
    {status === "error" && <p role="status">城市搜索未完成，请重新查找。</p>}
    {status === "ready" && results.length === 0 && <p role="status">没有找到相关城市</p>}
    {results.length > 0 && <div className="weather-city-results">{results.map(city => <button key={city.id} onClick={() => { onSelect(city); setResults([]); setStatus("idle"); setQuery(""); }}><strong>{city.name}</strong><small>{[city.admin1, city.country].filter(Boolean).join(" · ")}</small></button>)}</div>}
  </div>;
}
