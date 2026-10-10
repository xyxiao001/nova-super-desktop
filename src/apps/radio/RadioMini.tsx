import { useRef, useState, type PointerEvent } from "react";
import { clampDesktopObjectPosition } from "../../../app/desktopObjects";
import MediaCardThemes, { type MediaCardTheme } from "../../platform/desktop/MediaCardThemes";
import RadioShare from "./RadioShare";
import { RADIO_STATIONS, type RadioStation } from "./stations";

type RadioMiniProps = {
  station: RadioStation;
  stationIndex: number;
  requested: boolean;
  playing: boolean;
  statusLabel: string;
  onToggle: () => void;
  onTune: (index: number) => void;
  onOpen: () => void;
  onUnpin: () => void;
};

export default function RadioMini({
  station, stationIndex, requested, playing, statusLabel, onToggle, onTune, onOpen, onUnpin,
}: RadioMiniProps) {
  const [theme, setTheme] = useState<MediaCardTheme>("warm");
  const cardRef = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const moveTo = (x: number, y: number) => {
    const card = cardRef.current!;
    setPosition(clampDesktopObjectPosition(
      { x, y }, card.parentElement!.getBoundingClientRect(),
      { width: card.offsetWidth, height: card.offsetHeight },
    ));
  };
  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <section ref={cardRef} className={`radio-mini radio-card-${theme}`} aria-label="桌面迷你收音机"
    style={position ? { left: position.x, top: position.y, right: "auto" } : undefined}
    onPointerDown={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()}
    onTouchStart={event => event.stopPropagation()}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    <header className="radio-mini-top">
      <button className="radio-mini-handle" aria-label="移动迷你收音机" title="拖动摆放，方向键微调"
        onPointerDown={event => {
          if (event.button !== 0) return;
          const card = cardRef.current!;
          drag.current = { x: event.clientX, y: event.clientY, left: card.offsetLeft, top: card.offsetTop };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (drag.current) moveTo(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y);
        }}
        onPointerUp={endDrag} onPointerCancel={endDrag}
        onKeyDown={event => {
          const steps: Record<string, [number, number]> = {
            ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10],
          };
          if (!steps[event.key]) return;
          event.preventDefault();
          event.stopPropagation();
          const card = cardRef.current!;
          const [dx, dy] = steps[event.key];
          moveTo(card.offsetLeft + dx, card.offsetTop + dy);
        }}><strong>nova<span>radio</span></strong><span className="radio-mini-grip" aria-hidden="true">⠿</span></button>
      <button className="radio-mini-action" aria-label="打开完整收音机" title="打开完整收音机" onClick={onOpen}>↗</button>
      <button className="radio-mini-action" aria-label="取消桌面固定" title="移除桌面收音机" onClick={onUnpin}>×</button>
    </header>
    <div className="radio-mini-display">
      <div className="radio-mini-meta"><span className={`radio-signal ${playing ? "on" : ""}`}><i /> LIVE RADIO</span><span>CH {String(stationIndex + 1).padStart(2, "0")}</span></div>
      <h2>{station.name}</h2>
      <p>{station.location} · {station.category}</p>
      <div className="radio-mini-dial" aria-hidden="true"><i style={{ left: `${stationIndex / (RADIO_STATIONS.length - 1) * 100}%` }} /></div>
    </div>
    <div className="radio-mini-controls">
      <div className="radio-mini-speaker" aria-hidden="true" />
      <button className="radio-mini-skip" aria-label="上一个电台" disabled={stationIndex === 0} onClick={() => onTune(stationIndex - 1)}>‹</button>
      <button className="radio-mini-play" aria-label={requested ? "暂停播放" : "播放电台"} onClick={onToggle}><span className={requested ? "radio-pause-symbol" : "radio-play-symbol"} aria-hidden="true" /></button>
      <button className="radio-mini-skip" aria-label="下一个电台" disabled={stationIndex === RADIO_STATIONS.length - 1} onClick={() => onTune(stationIndex + 1)}>›</button>
    </div>
    <footer><span role="status">{statusLabel}</span><RadioShare key={station.id} station={station} /></footer>
    <div className="radio-card-style"><span>CARD EDITION</span><MediaCardThemes label="收音机卡片主题" value={theme} onChange={setTheme} /></div>
  </section>;
}
