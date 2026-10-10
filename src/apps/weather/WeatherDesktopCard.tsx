"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import DesktopWidget from "../../platform/desktop/DesktopWidget";
import { useRemoteData } from "../shared/useRemoteData";
import CitySearch from "./CitySearch";
import WeatherScene from "./WeatherScene";
import { currentWeatherLocation, readWeatherCardSettings, saveWeatherCardSettings } from "./weatherCardSettings";
import { WEATHER_CODES, weatherUrl, type WeatherData, type WeatherLocation } from "./weatherData";
import "./weather.css";

function LocationSettings({ onSelect, onCancel }: { onSelect: (location: WeatherLocation) => void; onCancel?: () => void }) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const locate = async () => {
    setStatus("locating");
    try {
      const location = await currentWeatherLocation();
      if (active.current) onSelect(location);
    } catch { if (active.current) setStatus("error"); }
  };
  return <div className="weather-card-settings">
    <h2>天气，就在桌面。</h2><p>选择位置，即可固定这张小卡片。</p>
    <button className="weather-locate" onClick={locate} disabled={status === "locating"}>⌖ {status === "locating" ? "正在定位…" : "使用当前位置"}</button>
    <small>定位用于查询 Open-Meteo 天气。</small>
    {status === "error" && <p role="status">未能获取定位，请检查浏览器定位权限。</p>}
    <div className="weather-card-divider">或手动设置城市</div>
    <CitySearch onSelect={onSelect} />
    {onCancel && <button className="weather-card-done" onClick={onCancel}>返回天气</button>}
  </div>;
}

type CardFrameProps = Pick<ComponentProps<typeof DesktopWidget>, "initialPosition" | "onPositionChange" | "onOpen" | "onUnpin">;
function CardFrame({ children, night = false, ...props }: CardFrameProps & { children: ReactNode; night?: boolean }) {
  return <DesktopWidget {...props} title="天气" className={`weather-widget ${night ? "weather-night" : ""}`} width={280} offset={{ right: 24, top: 20 }} openLabel="设置天气卡片" openIcon="⚙" removeTitle="移除桌面天气卡片">{children}</DesktopWidget>;
}

function ConfiguredCard({ location, editing, settingsForm, ...props }: CardFrameProps & { location: WeatherLocation; editing: boolean; settingsForm: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const result = useRemoteData<WeatherData>(weatherUrl(location), revision);
  const data = result.status === "ready" ? result.data : null;
  const condition = data ? WEATHER_CODES[data.current.weather_code] : null;
  return <CardFrame {...props} night={!editing && !!data && !data.current.is_day}>
    {editing ? settingsForm : <>
      {data && condition ? <WeatherScene className="weather-widget-content" kind={condition.kind} night={!data.current.is_day}>
        <div><h2>{location.name}</h2><strong>{Math.round(data.current.temperature_2m)}°</strong><p>{condition.label}</p></div>
      </WeatherScene> : <div className="weather-widget-content"><div><h2>{location.name}</h2><p role="status">{result.status === "error" ? "暂时无法获取天气" : "正在获取天气…"}</p></div></div>}
      <footer className="weather-card-footer"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo ↗</a><button aria-label="刷新桌面天气" onClick={() => setRevision(value => value + 1)} disabled={result.status === "loading"}>↻</button></footer>
    </>}
  </CardFrame>;
}

export default function WeatherDesktopCard({ onRemove }: { onRemove: () => void }) {
  const [settings, setSettings] = useState(readWeatherCardSettings);
  const [editing, setEditing] = useState(false);
  useEffect(() => saveWeatherCardSettings(settings), [settings]);
  const select = (location: WeatherLocation) => { setSettings(current => ({ ...current, location })); setEditing(false); };
  const frameProps: CardFrameProps = {
    initialPosition: settings.position,
    onPositionChange: position => setSettings(current => ({ ...current, position })),
    onOpen: () => setEditing(true),
    onUnpin: onRemove,
  };
  const form = <LocationSettings onSelect={select} onCancel={settings.location ? () => setEditing(false) : undefined} />;
  return settings.location
    ? <ConfiguredCard {...frameProps} location={settings.location} editing={editing} settingsForm={form} />
    : <CardFrame {...frameProps}>{form}</CardFrame>;
}
