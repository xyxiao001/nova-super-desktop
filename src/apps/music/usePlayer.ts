import { useCallback, useEffect, useRef, useState } from "react";
import type { Preferences, Track } from "./model";
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
  const graph = useRef<{
    context: AudioContext;
    gain: GainNode;
    analyser: AnalyserNode;
  } | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
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
  async function play(trackId: string, ids?: string[]) {
    const a = audio.current;
    if (!a) return;
    const track = latest.current.tracks.find((t) => t.id === trackId);
    if (!track) return;
    if (ids) setQueue(ids);
    const token = ++intent.current;
    if (current.current !== trackId) {
      a.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(track.audio);
      a.src = url.current;
      current.current = trackId;
      setId(trackId);
      setTime(0);
      setDuration(track.duration);
    }
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(a);
        const gain = context.createGain();
        gain.gain.value = latest.current.prefs.volume;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(gain);
        gain.connect(analyser);
        analyser.connect(context.destination);
        graph.current = { context, gain, analyser };
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
    if (audio.current) {
      audio.current.currentTime = value;
      setTime(value);
    }
  }
  function pause() {
    ++intent.current;
    audio.current?.pause();
  }
  function stop() {
    pause();
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
  const actionRef = useRef({ step, onError });
  actionRef.current = { step, onError };
  useEffect(() => {
    const a = new Audio();
    audio.current = a;
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
      void flushListening().catch((error) =>
        actionRef.current.onError(`听歌记录保存失败：${error.message}`),
      );
    };
    const halt = () => {
      capture();
      advancing = false;
      persist();
    };
    a.onplaying = () => {
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
    const tick = () => {
      setTime(a.currentTime);
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
      setTime(a.currentTime);
      meter.reset(Date.now(), a.currentTime);
      advancing = !a.paused;
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
      unsubscribe();
      halt();
      sampleListening.current = () => {};
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
      audio.current = null;
      if (url.current) URL.revokeObjectURL(url.current);
      current.current = null;
      if (graph.current) {
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
  return {
    id,
    analyser,
    flushListening,
    playing,
    time,
    duration,
    queue,
    setQueue,
    play,
    pause,
    stop,
    seek,
    step,
    toggle: () => (playing ? pause() : id ? void play(id) : undefined),
  };
}
export type Player = ReturnType<typeof usePlayer>;
