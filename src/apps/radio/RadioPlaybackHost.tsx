"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWindowRuntime } from "../../platform/windows/WindowRuntime";
import RadioMini from "./RadioMini";
import { RADIO_STATIONS } from "./stations";
import { radioSession, useRadioSession, STATUS_LABELS, type RadioSessionState } from "./radioSession";
import { sharedStationIndex } from "./sharing";
import "./radio.css";

const setStatus = (status: RadioSessionState["status"]) => radioSession.update({ status });
const setRequested = (requested: boolean) => radioSession.update({ requested });

export default function RadioSession() {
  const { desktopSurface, openApp, isAppOpen } = useWindowRuntime();
  const { stationIndex, requested, status, volume, pinned } = useRadioSession();
  const audioRef = useRef<HTMLAudioElement>(null);
  const station = RADIO_STATIONS[stationIndex];
  const windowOpen = isAppOpen("radio");
  useEffect(() => {
    const index = sharedStationIndex(location.search);
    if (index !== -1) radioSession.update({ stationIndex: index });
  }, []);
  useEffect(() => {
    if (!windowOpen) radioSession.releaseWindow();
  }, [windowOpen, pinned]);
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


  return <>
    <audio ref={audioRef} crossOrigin="anonymous" preload="none"
      onPlaying={() => setStatus("playing")}
      onWaiting={() => { if (requested) setStatus("connecting"); }}
      onError={() => { setStatus("error"); setRequested(false); }}
      onEnded={() => { setStatus("paused"); setRequested(false); }} />
    {pinned && desktopSurface && createPortal(<RadioMini
      station={station} stationIndex={stationIndex} requested={requested}
      playing={status === "playing"} statusLabel={STATUS_LABELS[status]}
      onToggle={radioSession.togglePlayback} onTune={radioSession.tune}
      onOpen={() => openApp("radio")} onUnpin={() => radioSession.update({ pinned: false })}
    />, desktopSurface)}
  </>;
}
