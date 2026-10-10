import { useState, type CSSProperties, type ReactNode } from "react";
import WeatherSymbol from "./WeatherSymbol";
import type { WeatherKind } from "./weatherData";
import "./weatherScene.css";

const interactions: Record<WeatherKind, string> = {
  clear: "轻点感受日照", cloudy: "轻点拨动云朵", rain: "轻点泛起雨滴涟漪",
  storm: "轻点亮起闪电", snow: "轻点扬起雪花", fog: "轻点拂过薄雾",
};

export default function WeatherScene({ kind, night, className, children }: {
  kind: WeatherKind; night: boolean; className: string; children: ReactNode;
}) {
  const [pulse, setPulse] = useState(0);
  const label = night && kind === "clear" ? "轻点感受月光" : interactions[kind];
  return <div className={`weather-scene scene-${kind} ${night ? "scene-night" : ""} ${className}`}
    onPointerMove={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      event.currentTarget.style.setProperty("--weather-light-x", `${x * 100}%`);
      event.currentTarget.style.setProperty("--weather-light-y", `${(event.clientY - rect.top) / rect.height * 100}%`);
      event.currentTarget.style.setProperty("--weather-drift", `${(x - .5) * 12}px`);
      event.currentTarget.style.setProperty("--weather-wind", `${(x - .5) * 14 - 8}deg`);
    }}
    onPointerLeave={event => {
      for (const name of ["--weather-light-x", "--weather-light-y", "--weather-drift", "--weather-wind"]) event.currentTarget.style.removeProperty(name);
    }}>
    <div className="weather-atmosphere" aria-hidden="true">
      <i className="weather-light" /><i className="weather-rays" /><i className="weather-haze" />
      {(kind === "rain" || kind === "storm" || kind === "snow") && <span className="weather-particles">{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ "--particle-x": `${(index * 37 + 7) % 100}%`, "--particle-delay": `${-index * .37}s`, "--particle-duration": `${.85 + (index % 5) * .18}s` } as CSSProperties} />)}</span>}
      {pulse > 0 && <i key={`${kind}-${pulse}`} className="weather-touch-effect" />}
    </div>
    {children}
    <button className="weather-touch" aria-label={label} title={label} onClick={() => setPulse(value => value + 1)}>
      <WeatherSymbol kind={kind} night={night} />
      <small>轻点，感受天气</small>
    </button>
  </div>;
}
