"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useWindowInstance, useWindowRuntime } from "../../platform/windows/WindowRuntime";
import RadioMini from "./RadioMini";
import { RADIO_STATIONS } from "./stations";
import "./radio.css";

type PlaybackStatus = "idle" | "connecting" | "playing" | "paused" | "error";
const STATUS_LABELS: Record<PlaybackStatus, string> = {
  idle: "等待收听", connecting: "正在连接", playing: "正在直播", paused: "已暂停", error: "暂时无法播放此电台",
};
const CATEGORIES = ["全部", "音乐", "新闻", "生活"] as const;

export default function RadioApp() {
  const { desktopSurface, minimizeInstance, focusInstance } = useWindowRuntime();
  const { id: instanceId } = useWindowInstance();
  const [pinned, setPinned] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [stationIndex, setStationIndex] = useState(0);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [volume, setVolume] = useState(70);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("全部");
  const station = RADIO_STATIONS[stationIndex];
  const stations = RADIO_STATIONS.filter(item =>
    (category === "全部" || item.category === category) &&
    `${item.name} ${item.location}`.includes(query.trim()),
  );

  useEffect(() => {
    const audio = audioRef.current!;
    if (!requested) return;
    let cancelled = false;
    let stopHls: (() => void) | undefined;
    const fail = () => {
      if (!cancelled) {
        setStatus("error");
        setRequested(false);
      }
    };
    const play = () => { audio.play().catch(fail); };
    if (station.format === "hls") {
      import("./hlsPlayback").then(({ startHlsPlayback }) => {
        if (!cancelled) stopHls = startHlsPlayback(audio, station.url, play, fail);
      }).catch(fail);
    } else {
      audio.src = station.url;
      play();
    }
    return () => {
      cancelled = true;
      stopHls?.();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [station.url, station.format, requested]);

  useEffect(() => {
    audioRef.current!.volume = volume / 100;
  }, [volume]);

  function tune(index: number) {
    setStationIndex(index);
    if (index !== stationIndex || !requested) {
      setStatus("connecting");
      setRequested(true);
    }
  }

  function togglePlayback() {
    setStatus(requested ? "paused" : "connecting");
    setRequested(!requested);
  }

  const unpin = () => { setPinned(false); focusInstance(instanceId); };

  return <><main className="nova-radio" aria-label="NOVA 收音机">
    <audio ref={audioRef} crossOrigin="anonymous" preload="none"
      onPlaying={() => setStatus("playing")}
      onWaiting={() => { if (requested) setStatus("connecting"); }}
      onError={() => { setStatus("error"); setRequested(false); }}
      onEnded={() => { setStatus("paused"); setRequested(false); }} />
    <header className="radio-header">
      <div className="radio-brand"><span className="radio-brand-mark" aria-hidden="true">◉</span><div><strong>NOVA <span>收音机</span></strong><small>A LITTLE SIGNAL. A LITTLE COMPANY.</small></div></div>
      <button className="radio-pin" aria-pressed={pinned} onClick={() => {
        if (pinned) unpin();
        else { setPinned(true); minimizeInstance(instanceId); }
      }}><span aria-hidden="true">⌖</span>{pinned ? "取消桌面固定" : "钉到桌面"}</button>
    </header>
    <div className="radio-workspace">
      <aside className="radio-library" aria-label="电台目录">
        <div className="radio-library-heading"><h2>发现电台</h2><span>{RADIO_STATIONS.length.toString().padStart(2, "0")} STATIONS</span></div>
        <label className="radio-search"><span aria-hidden="true">⌕</span><input aria-label="搜索电台" placeholder="搜索电台或城市" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <nav className="radio-categories" aria-label="电台分类">{CATEGORIES.map(item => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</nav>
        <div className="radio-stations">
          {stations.map(item => {
            const index = RADIO_STATIONS.indexOf(item);
            const selected = station.id === item.id;
            return <button className={`radio-station ${selected ? "selected" : ""}`} key={item.id} aria-pressed={selected} onClick={() => tune(index)}>
              <span className={`radio-station-art category-${item.category}`} aria-hidden="true">{item.category === "音乐" ? "♫" : item.category === "新闻" ? "≋" : "☷"}</span>
              <span className="radio-station-text"><strong>{item.name}</strong><small>{item.location} <span>· {item.category}</span></small></span>
              <span className="radio-station-end" aria-hidden="true">{selected ? "●" : String(index + 1).padStart(2, "0")}</span>
            </button>;
          })}
          {stations.length === 0 && <p className="radio-empty">没有找到相关电台</p>}
        </div>
        <a className="radio-source" href="https://www.radio-browser.info/" target="_blank" rel="noreferrer">电台来源 Radio Browser <span aria-hidden="true">↗</span></a>
      </aside>
      <section className="radio-listening" aria-label="正在收听">
        <div className="radio-section-label"><span>YOUR DAILY SOUNDTRACK</span><span>N° {String(stationIndex + 1).padStart(2, "0")}</span></div>
        <div className="radio-intro"><h1>给此刻，一点声音。</h1><p>转动日常的频率，让喜欢的声音陪着你。</p></div>
        <div className="radio-receiver">
          <div className="radio-receiver-top"><strong>nova<span>radio</span></strong><span>INTERNET RECEIVER / 01</span></div>
          <div className="radio-display">
            <div className="radio-display-meta"><span className={status === "playing" ? "radio-signal on" : "radio-signal"}><i /> ONLINE RADIO</span><span>CH {String(stationIndex + 1).padStart(2, "0")}</span></div>
            <h2>{station.name}</h2>
            <div className="radio-display-detail"><span>{station.location} / {station.category}</span><span lang="en">{station.format.toUpperCase()} STREAM</span></div>
            <div className="radio-tuner" aria-hidden="true"><div className="radio-tuner-ticks" /><i style={{ left: `${4 + stationIndex / (RADIO_STATIONS.length - 1) * 92}%` }} /><div className="radio-tuner-numbers">{RADIO_STATIONS.map((item, index) => <span key={item.id}>{String(index + 1).padStart(2, "0")}</span>)}</div></div>
          </div>
          <div className="radio-hardware"><div className="radio-speaker" aria-hidden="true" /><div className="radio-power"><button className={`radio-play ${requested ? "active" : ""}`} onClick={togglePlayback} aria-label={requested ? "暂停播放" : "播放电台"}><span className={requested ? "radio-pause-symbol" : "radio-play-symbol"} aria-hidden="true" /></button><span>PRESS TO {requested ? "PAUSE" : "PLAY"}</span></div></div>
          <div className="radio-receiver-foot"><span>DESIGNED FOR SLOW MOMENTS</span><span>● &nbsp; NOVA AUDIO</span></div>
        </div>
        <p className="radio-station-description">{station.description}</p>
        <div className="radio-player-bar">
          <div className="radio-playback-status" role="status"><span className={`radio-status-dot ${status === "playing" ? "on" : ""}`} /><span>{STATUS_LABELS[status]}</span></div>
          <div className="radio-skip"><button aria-label="上一个电台" disabled={stationIndex === 0} onClick={() => tune(stationIndex - 1)}>‹</button><span>切换电台</span><button aria-label="下一个电台" disabled={stationIndex === RADIO_STATIONS.length - 1} onClick={() => tune(stationIndex + 1)}>›</button></div>
          <label className="radio-volume"><span>音量</span><input type="range" min="0" max="100" aria-label="音量" value={volume} style={{ "--radio-volume": `${volume}%` } as CSSProperties} onChange={event => setVolume(Number(event.target.value))} /><output>{volume}</output></label>
        </div>
      </section>
    </div>
  </main>
    {pinned && desktopSurface && createPortal(<RadioMini
      station={station} stationIndex={stationIndex} requested={requested}
      playing={status === "playing"} statusLabel={STATUS_LABELS[status]}
      onToggle={togglePlayback} onTune={tune}
      onOpen={() => focusInstance(instanceId)} onUnpin={unpin}
    />, desktopSurface)}
  </>;
}
