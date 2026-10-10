"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import DesktopWidget from "../../platform/desktop/DesktopWidget";
import { useRemoteData } from "../shared/useRemoteData";
import CitySearch from "./CitySearch";
import WeatherScene from "./WeatherScene";
import { currentWeatherLocation, readWeatherCardSettings, resolveWeatherLocation, saveWeatherCardSettings } from "./weatherCardSettings";
import { WEATHER_CODES, weatherUrl, type WeatherData, type WeatherLocation } from "./weatherData";
import "./weather.css";

function LocationSettings({ onSelect, onCancel }: { onSelect: (location: WeatherLocation) => void; onCancel?: () => void }) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; request.current = new AbortController(); return () => { active.current = false; request.current!.abort(); }; }, []);
  const locate = async () => {
    setStatus("locating");
    try {
      const location = await currentWeatherLocation(request.current!.signal);
      if (active.current) onSelect(location);
    } catch { if (active.current) setStatus("error"); }
  };
  return <div className="weather-card-settings">
    <h2>天气，就在桌面。</h2><p>选择位置，即可固定这张小卡片。</p>
    <button className="weather-locate" onClick={locate} disabled={status === "locating"}>⌖ {status === "locating" ? "正在定位…" : "使用当前位置"}</button>
    <small>定位用于查询天气及 Photon 城市名称。</small>
    {status === "error" && <p role="status">位置识别未完成，请重新定位。</p>}
    <div className="weather-card-divider">或手动设置城市</div>
    <CitySearch onSelect={onSelect} />
    {onCancel && <button className="weather-card-done" onClick={onCancel}>返回天气</button>}
  </div>;
}

type CardFrameProps = Pick<ComponentProps<typeof DesktopWidget>, "initialPosition" | "onPositionChange" | "onOpen" | "onUnpin">;
function CardFrame({ children, night = false, ...props }: CardFrameProps & { children: ReactNode; night?: boolean }) {
  return <DesktopWidget {...props} title="天气" className={`weather-widget ${night ? "weather-night" : ""}`} width={280} offset={{ right: 24, top: 20 }} openLabel="设置天气卡片" openIcon="⚙" removeTitle="移除桌面天气卡片">{children}</DesktopWidget>;
}

function ConfiguredCard({ location, locationName, editing, settingsForm, ...props }: CardFrameProps & { location: WeatherLocation; locationName: string; editing: boolean; settingsForm: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const result = useRemoteData<WeatherData>(weatherUrl(location), revision);
  const data = result.status === "ready" ? result.data : null;
  const condition = data ? WEATHER_CODES[data.current.weather_code] : null;
  return <CardFrame {...props} night={!editing && !!data && !data.current.is_day}>
    {editing ? settingsForm : <>
      {data && condition ? <WeatherScene className="weather-widget-content" kind={condition.kind} night={!data.current.is_day}>
        <div><h2 className="weather-location-name" title={locationName}>{locationName.split(" · ").map((part, index) => <span key={index}>{part}</span>)}</h2><strong>{Math.round(data.current.temperature_2m)}°</strong><p>{condition.label}</p></div>
      </WeatherScene> : <div className="weather-widget-content"><div><h2 className="weather-location-name" title={locationName}>{locationName.split(" · ").map((part, index) => <span key={index}>{part}</span>)}</h2><p role="status">{result.status === "error" ? "暂时无法获取天气" : "正在获取天气…"}</p></div></div>}
      <footer className="weather-card-footer"><div><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo ↗</a>{location.placeSource === "photon" && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">地点 © OpenStreetMap · Photon</a>}</div><button aria-label="刷新桌面天气" onClick={() => setRevision(value => value + 1)} disabled={result.status === "loading"}>↻</button></footer>
    </>}
  </CardFrame>;
}

export default function WeatherDesktopCard({ onRemove }: { onRemove: () => void }) {
  const [settings, setSettings] = useState(readWeatherCardSettings);
  const [editing, setEditing] = useState(false);
  const [nameError, setNameError] = useState(false);
  useEffect(() => saveWeatherCardSettings(settings), [settings]);
  useEffect(() => {
    const location = settings.location;
    if (location?.name !== "当前位置") return;
    const controller = new AbortController();
    setNameError(false);
    resolveWeatherLocation(location, controller.signal)
      .then(resolved => { if (!controller.signal.aborted) setSettings(current => ({ ...current, location: resolved })); })
      .catch(() => { if (!controller.signal.aborted) setNameError(true); });
    return () => controller.abort();
  }, [settings.location]);
  const select = (location: WeatherLocation) => { setSettings(current => ({ ...current, location })); setEditing(false); };
  const frameProps: CardFrameProps = {
    initialPosition: settings.position,
    onPositionChange: position => setSettings(current => ({ ...current, position })),
    onOpen: () => setEditing(true),
    onUnpin: onRemove,
  };
  const form = <LocationSettings onSelect={select} onCancel={settings.location ? () => setEditing(false) : undefined} />;
  return settings.location
    ? <ConfiguredCard {...frameProps} location={settings.location} locationName={settings.location.name === "当前位置" ? (nameError ? "未能识别城市" : "正在识别位置…") : settings.location.name} editing={editing} settingsForm={form} />
    : <CardFrame {...frameProps}>{form}</CardFrame>;
}
