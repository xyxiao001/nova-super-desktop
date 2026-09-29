import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackBookmark, Preferences, Track } from "./model";
import { savePlayback } from "./storage";
import { createPlaybackResume } from "./playbackResume";
import { connectMediaSession, publishMediaTrack } from "./mediaSession";
import { createListeningEffects, type SoundPreset } from "./listeningEffects";
import { scheduleShowGain, type ActiveShow } from "./show";
import {
  addListeningTime,
  ListeningMeter,
  type ListeningDay,
} from "./listeningHistory";
import {
  subscribeWindowClosing,
  useWindowInstance,
} from "../../platform/windows/WindowRuntime";
export function usePlayer(
  tracks: Track[],
  prefs: Preferences,
  onError: (message: string) => void,
) {
  const instance = useWindowInstance();
  const audio = useRef<HTMLAudioElement | null>(null);
  const resumePosition = useRef<ReturnType<typeof createPlaybackResume> | null>(null);
  const graph = useRef<{
    context: AudioContext;
    gain: GainNode;
    fade: GainNode;
    analyser: AnalyserNode;
    source: MediaElementAudioSourceNode;
    effects: ReturnType<typeof createListeningEffects> | null;
  } | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [sound, setSound] = useState<SoundPreset>("original");
  const [rainVolume, setRainVolume] = useState(0);
  const [show, setShow] = useState<ActiveShow | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const showRef = useRef<ActiveShow | null>(null);
  const intervalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIntervalTimer = () => {
    if (intervalTimer.current !== null) clearTimeout(intervalTimer.current);
    intervalTimer.current = null;
  };
  const stopShow = () => {
    clearIntervalTimer();
    showRef.current = null;
    setShow(null);
    setShowFinished(false);
    if (graph.current) {
      graph.current.fade.gain.cancelScheduledValues(graph.current.context.currentTime);
      graph.current.fade.gain.setValueAtTime(1, graph.current.context.currentTime);
    }
  };
  const scheduleEnvelope = () => {
    if (graph.current && audio.current && showRef.current) {
      scheduleShowGain(graph.current.fade.gain, audio.current.currentTime, audio.current.duration,
        graph.current.context.currentTime, showRef.current.transition, !audio.current.paused);
    }
  };
  const pendingListening = useRef<ListeningDay[]>([]);
  const persistListening = useRef<Promise<void>>(Promise.resolve());
  const sampleListening = useRef<() => void>(() => {});
  const flushListening = useCallback(() => {
    sampleListening.current();
    const rows = pendingListening.current.splice(0);
    const saving = addListeningTime(rows);
    persistListening.current = Promise.all([
      persistListening.current,
      saving,
    ]).then(() => undefined);
    return persistListening.current;
  }, []);
  const url = useRef("");
  const intent = useRef(0);
  const current = useRef<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<string[]>([]);
  const latest = useRef({ tracks, prefs, queue });
  latest.current = { tracks, prefs, queue };
  async function play(trackId: string, ids?: string[], fromShow = false, startAt?: number) {
    const a = audio.current;
    if (!a) return;
    const track = latest.current.tracks.find((t) => t.id === trackId);
    if (!track) return;
    clearIntervalTimer();
    if (ids && !fromShow) stopShow();
    setShowFinished(false);
    const token = ++intent.current;
    if (current.current !== trackId) {
      a.pause();
      resumePosition.current?.clear();
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(track.audio);
      a.src = url.current;
      current.current = trackId;
      setId(trackId);
      setTime(0);
      setDuration(track.duration);
    }
    if (ids) {
      latest.current.queue = ids;
      setQueue(ids);
    }
    if (startAt !== undefined) {
      resumePosition.current?.seekWhenReady(startAt);
      setTime(startAt);
    }
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(a);
        const gain = context.createGain();
        const fade = context.createGain();
        gain.gain.value = latest.current.prefs.volume;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(fade);
        fade.connect(gain);
        gain.connect(analyser);
        analyser.connect(context.destination);
        graph.current = { context, gain, fade, analyser, source, effects: null };
        setAnalyser(analyser);
      }
      await graph.current.context.resume();
      if (token !== intent.current) return;
      await a.play();
    } catch (error) {
      if (token === intent.current)
        onError(`播放失败：${(error as Error).message}`);
    }
  }
  function seek(value: number) {
    clearIntervalTimer();
    setShowFinished(false);
    if (audio.current) {
      resumePosition.current?.clear();
      audio.current.currentTime = value;
      setTime(value);
    }
  }
  function pause() {
    clearIntervalTimer();
    ++intent.current;
    audio.current?.pause();
  }
  function stop() {
    stopShow();
    pause();
    resumePosition.current?.clear();
    current.current = null;
    setId(null);
    setTime(0);
    setDuration(0);
    if (audio.current) {
      audio.current.removeAttribute("src");
      audio.current.load();
    }
    if (url.current) {
      URL.revokeObjectURL(url.current);
      url.current = "";
    }
  }
  function step(direction: number, ended = false) {
    clearIntervalTimer();
    const performance = showRef.current;
    if (performance) {
      const next = performance.tracks.indexOf(current.current!) + direction;
      if (next >= performance.tracks.length) {
        pause();
        setShowFinished(true);
      } else if (next < 0) {
        seek(0);
      } else if (ended && performance.transition === "pause") {
        intervalTimer.current = setTimeout(() => { void actionRef.current.play(performance.tracks[next]); }, 2000);
      } else {
        void play(performance.tracks[next]);
      }
      return;
    }
    const { queue: ids, prefs: p } = latest.current;
    const index = ids.indexOf(current.current ?? "");
    if (!ids.length) return;
    if (ended && p.mode === "one") {
      seek(0);
      void play(ids[index]);
      return;
    }
    if (p.mode === "shuffle") {
      const candidates = ids.filter((item) => item !== current.current);
      void play(
        candidates.length
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : ids[0],
      );
      return;
    }
    const next = index + direction;
    if (ended && p.mode === "order" && next >= ids.length) {
      pause();
      return;
    }
    void play(ids[(next + ids.length) % ids.length]);
  }
  const actionRef = useRef({ step, play, pause, seek, onError });
  actionRef.current = { step, play, pause, seek, onError };
  const selected = tracks.find((track) => track.id === id);
  useEffect(() => {
    if (selected) return publishMediaTrack(navigator.mediaSession, selected);
  }, [selected?.id, selected?.title, selected?.artist, selected?.album, selected?.cover]);
  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    const resume = createPlaybackResume(a);
    resumePosition.current = resume;
    const persistPlayback = () => {
      if (!current.current) return;
      void savePlayback({
        trackId: current.current,
        time: resume.position(),
        queue: [...latest.current.queue],
      }).catch((error) => actionRef.current.onError(`播放位置保存失败：${error.message}`));
    };
    const disconnectMediaSession = connectMediaSession(a, navigator.mediaSession, {
      play: () => { if (current.current) void actionRef.current.play(current.current); },
      pause: () => actionRef.current.pause(),
      previous: () => actionRef.current.step(-1),
      next: () => actionRef.current.step(1),
      seek: (value) => actionRef.current.seek(value),
    });
    const meter = new ListeningMeter();
    let advancing = false;
    let sinceFlush = 0;
    const capture = () => {
      const track = latest.current.tracks.find((t) => t.id === current.current);
      if (!advancing || a.seeking || !track) return;
      const rows = meter.sample(
        { hash: track.audioHash!, title: track.title, artist: track.artist },
        Date.now(),
        a.currentTime,
      );
      pendingListening.current.push(...rows);
      sinceFlush += rows.reduce((n, row) => n + row.seconds, 0);
    };
    sampleListening.current = capture;
    const persist = () => {
      sinceFlush = 0;
      persistPlayback();
      void flushListening().catch((error) =>
        actionRef.current.onError(`听歌记录保存失败：${error.message}`),
      );
    };
    const halt = () => {
      if (graph.current) graph.current.fade.gain.cancelAndHoldAtTime(graph.current.context.currentTime);
      capture();
      advancing = false;
      persist();
    };
    a.onplaying = () => {
      persistPlayback();
      scheduleEnvelope();
      meter.reset(Date.now(), a.currentTime);
      advancing = true;
    };
    a.ontimeupdate = () => {
      capture();
      if (sinceFlush >= 15) persist();
    };
    a.onseeking = () => {
      advancing = false;
    };
    a.onwaiting = halt;
    const resetHistory = () => {
      pendingListening.current = [];
      sinceFlush = 0;
      meter.reset(Date.now(), a.currentTime);
    };
    window.addEventListener("nova-music-history-changed", resetHistory);
    const pageHide = () => persist();
    window.addEventListener("pagehide", pageHide);
    let frame = 0;
    const compact = matchMedia("(max-width: 680px), (max-width: 932px) and (pointer: coarse)");
    let lastPaint = 0;
    const tick = (now: number) => {
      if (!compact.matches || now - lastPaint >= 50) {
        setTime(a.currentTime);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    a.onplay = () => {
      setPlaying(true);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    a.onpause = () => {
      halt();
      setPlaying(false);
      cancelAnimationFrame(frame);
      setTime(a.currentTime);
    };
    a.onloadedmetadata = () => setDuration(a.duration);
    a.onseeked = () => {
      scheduleEnvelope();
      setTime(a.currentTime);
      meter.reset(Date.now(), a.currentTime);
      advancing = !a.paused;
      persistPlayback();
    };
    a.onended = () => {
      halt();
      actionRef.current.step(1, true);
    };
    a.onerror = () =>
      actionRef.current.onError(`无法解码此音频：${a.error?.message}`);
    const unsubscribe = subscribeWindowClosing(instance.id, () => {
      a.pause();
    });
    return () => {
      clearIntervalTimer();
      unsubscribe();
      halt();
      sampleListening.current = () => {};
      resume.dispose();
      resumePosition.current = null;
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("nova-music-history-changed", resetHistory);
      a.onplaying = null;
      a.ontimeupdate = null;
      a.onseeking = null;
      a.onwaiting = null;
      ++intent.current;
      cancelAnimationFrame(frame);
      a.onplay = null;
      a.onpause = null;
      a.onerror = null;
      a.onended = null;
      a.onloadedmetadata = null;
      a.onseeked = null;
      a.pause();
      a.removeAttribute("src");
      a.load();
      disconnectMediaSession();
      audio.current = null;
      if (url.current) URL.revokeObjectURL(url.current);
      current.current = null;
      if (graph.current) {
        graph.current.effects?.dispose();
        void graph.current.context.close();
        graph.current = null;
      }
    };
  }, [instance.id, flushListening]);
  useEffect(() => {
    if (graph.current)
      graph.current.gain.gain.setValueAtTime(
        prefs.volume,
        graph.current.context.currentTime,
      );
  }, [prefs.volume]);
  useEffect(() => {
    const nodes = graph.current;
    if (!nodes) return;
    if (!nodes.effects && (sound !== "original" || rainVolume > 0)) {
      nodes.effects = createListeningEffects(nodes.context);
      nodes.source.disconnect(nodes.fade);
      nodes.source.connect(nodes.effects.input);
      nodes.effects.output.connect(nodes.fade);
    }
    nodes.effects?.setSound(sound);
    nodes.effects?.setRain(rainVolume, playing);
  }, [sound, rainVolume, playing, analyser]);
  return {
    id,
    analyser,
    sound, setSound, rainVolume, setRainVolume,
    show, showFinished, stopShow,
    startShow: (value: ActiveShow) => {
      showRef.current = value;
      setShow(value);
      seek(0);
      void play(value.tracks[0], value.tracks, true);
    },
    flushListening,
    playing,
    time,
    duration,
    queue,
    setQueue,
    play,
    resume: (bookmark: PlaybackBookmark) => play(bookmark.trackId, bookmark.queue, false, bookmark.time),
    pause,
    stop,
    seek,
    step,
    toggle: () => (playing ? pause() : id ? void play(id) : undefined),
  };
}
export type Player = ReturnType<typeof usePlayer>;
