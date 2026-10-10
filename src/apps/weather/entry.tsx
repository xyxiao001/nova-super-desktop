"use client";

import { useState } from "react";
import WeatherSymbol from "./WeatherSymbol";
import WeatherScene from "./WeatherScene";
import { useRemoteData } from "../shared/useRemoteData";
import CitySearch from "./CitySearch";
import { WUHAN, WEATHER_CODES, formatWeatherTime, upcomingHours, weatherUrl, type WeatherData } from "./weatherData";
import "./weather.css";

export default function WeatherApp() {
  const [city, setCity] = useState(WUHAN);
  const [revision, setRevision] = useState(0);
  const result = useRemoteData<WeatherData>(weatherUrl(city), revision);
  const data = result.status === "ready" ? result.data : null;
  const condition = data ? WEATHER_CODES[data.current.weather_code] : null;
  const hours = data ? upcomingHours(data) : [];

  return <><main className={`nova-weather ${data && !data.current.is_day ? "weather-night" : ""}`} aria-label="NOVA 天气">
    <header className="weather-header"><div><strong>NOVA <span>天气</span></strong><small>A WINDOW TO THE OUTSIDE.</small></div></header>
    <div className="weather-layout">
      <aside className="weather-sidebar"><div className="weather-side-heading"><span>YOUR PLACE</span><h2>世界的另一扇窗。</h2></div><CitySearch onSelect={setCity} />
        <div className="weather-selected-city"><span>当前城市</span><h3>{city.name}</h3><p>{[city.admin1, city.country].filter(Boolean).join(" · ")}</p><small>{city.timezone}</small></div>
        <div className="weather-side-bottom"><p>把窗外的天气，<br />放在桌面的一角。</p><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气数据 Open-Meteo ↗</a></div>
      </aside>
      <section className="weather-main" aria-label="天气预报">
        <div className="weather-main-heading"><span>{data ? new Intl.DateTimeFormat("zh-CN", { timeZone: city.timezone, month: "long", day: "numeric", weekday: "long" }).format(data.current.time * 1000) : city.name}</span><button className="weather-refresh" onClick={() => setRevision(value => value + 1)} disabled={result.status === "loading"}>↻ 更新天气</button></div>
        {result.status === "loading" && <div className="weather-message" role="status"><span aria-hidden="true">☁</span><h2>正在打开这扇窗…</h2><p>获取{city.name}的天气预报</p></div>}
        {result.status === "error" && <div className="weather-message" role="status"><h2>暂时没有收到天气数据</h2><p>点击「更新天气」再次获取。</p></div>}
        {data && condition && <>
          <WeatherScene className="weather-now" kind={condition.kind} night={!data.current.is_day}>
            <div className="weather-now-copy"><p>{city.name}<span>现在</span></p><h1>{Math.round(data.current.temperature_2m)}<sup>°</sup></h1><h2>{condition.label}</h2><small>最高 {Math.round(data.daily.temperature_2m_max[0])}° · 最低 {Math.round(data.daily.temperature_2m_min[0])}°</small></div>
            <span className="weather-now-caption">TAKE A MOMENT. LOOK OUTSIDE.</span>
          </WeatherScene>
          <div className="weather-facts"><div><small>体感温度</small><strong>{Math.round(data.current.apparent_temperature)}<span> °C</span></strong></div><div><small>空气湿度</small><strong>{data.current.relative_humidity_2m}<span> %</span></strong></div><div><small>风速</small><strong>{data.current.wind_speed_10m}<span> km/h</span></strong></div></div>
          <section className="weather-forecast-section"><header><h2>接下来的 12 小时</h2><span>温度 / 降雨概率</span></header><div className="weather-hourly">{hours.map(hour => <div className="weather-hour" key={hour.time}><small>{formatWeatherTime(hour.time, city.timezone)}</small><WeatherSymbol kind={WEATHER_CODES[hour.code].kind} night={!hour.isDay} /><strong>{Math.round(hour.temperature)}°</strong><span>{hour.rain}%</span></div>)}</div></section>
          <section className="weather-forecast-section"><header><h2>未来 7 天</h2><span>DAILY FORECAST</span></header><div className="weather-week">{data.daily.time.map((time, index) => <div className="weather-day" key={time}><span>{index === 0 ? "今天" : new Intl.DateTimeFormat("zh-CN", { timeZone: city.timezone, weekday: "short" }).format(time * 1000)}</span><WeatherSymbol kind={WEATHER_CODES[data.daily.weather_code[index]].kind} /><small>{WEATHER_CODES[data.daily.weather_code[index]].label}</small><span className="weather-day-low">{Math.round(data.daily.temperature_2m_min[index])}°</span><div className="weather-day-bar"><i style={{ left: `${(data.daily.temperature_2m_min[index] - Math.min(...data.daily.temperature_2m_min)) / (Math.max(...data.daily.temperature_2m_max) - Math.min(...data.daily.temperature_2m_min)) * 100}%`, width: `${(data.daily.temperature_2m_max[index] - data.daily.temperature_2m_min[index]) / (Math.max(...data.daily.temperature_2m_max) - Math.min(...data.daily.temperature_2m_min)) * 100}%` }} /></div><strong>{Math.round(data.daily.temperature_2m_max[index])}°</strong></div>)}</div></section>
          <p className="weather-updated">数据时间 {formatWeatherTime(data.current.time, city.timezone)} · 城市当地时间 · °C / km/h</p>
        </>}
      </section>
    </div>
  </main>
  </>;
}
