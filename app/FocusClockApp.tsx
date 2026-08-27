"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  appendFocusSession,
  focusSessionStats,
  formatClockDuration,
  timerProgress,
  timerRemaining,
  type FocusSession,
} from "./focusClock";
import { playNovaSound } from "./novaSettings";

type ClockView = "focus" | "timer" | "stopwatch";
type FocusPreset = "focus" | "short" | "long";

const SESSION_KEY = "nova-focus-sessions";
const FOCUS_PRESETS: { id: FocusPreset; label: string; seconds: number }[] = [
  { id: "focus", label: "专注", seconds: 25 * 60 },
  { id: "short", label: "短休息", seconds: 5 * 60 },
  { id: "long", label: "长休息", seconds: 15 * 60 },
];

const readSessions = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "[]") as FocusSession[];
  } catch {
    return [];
  }
};

export default function FocusClockApp({ active }: { active: boolean }) {
  const [view, setView] = useState<ClockView>("focus");
  const [preset, setPreset] = useState<FocusPreset>("focus");
  const [total, setTotal] = useState(FOCUS_PRESETS[0].seconds);
  const [remaining, setRemaining] = useState(FOCUS_PRESETS[0].seconds);
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [stopwatch, setStopwatch] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>(readSessions);
  const completionRef = useRef(false);
  const stopwatchStartRef = useRef(0);

  const stats = useMemo(() => focusSessionStats(sessions), [sessions]);
  const progress = view === "stopwatch" ? 0 : timerProgress(total, remaining);

  const saveSession = (duration: number) => {
    setSessions((current) => {
      const next = appendFocusSession(current, { endedAt: Date.now(), duration });
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    });
  };

  const pauseCountdown = () => {
    if (endAt) setRemaining(timerRemaining(endAt, Date.now()));
    setRunning(false);
    setEndAt(null);
  };

  const toggleCountdown = () => {
    if (running) {
      pauseCountdown();
      return;
    }
    const duration = remaining || total;
    completionRef.current = false;
    setRemaining(duration);
    setEndAt(Date.now() + duration * 1000);
    setRunning(true);
  };

  const resetCountdown = (seconds = total) => {
    completionRef.current = false;
    setRunning(false);
    setEndAt(null);
    setTotal(seconds);
    setRemaining(seconds);
  };

  const choosePreset = (next: FocusPreset) => {
    const config = FOCUS_PRESETS.find((item) => item.id === next)!;
    setPreset(next);
    resetCountdown(config.seconds);
  };

  const chooseView = (next: ClockView) => {
    if (running) pauseCountdown();
    if (stopwatchRunning) setStopwatchRunning(false);
    setView(next);
    if (next === "focus") {
      const config = FOCUS_PRESETS.find((item) => item.id === preset)!;
      resetCountdown(config.seconds);
    }
    if (next === "timer") resetCountdown(timerMinutes * 60);
  };

  const toggleStopwatch = () => {
    if (stopwatchRunning) {
      setStopwatchRunning(false);
      return;
    }
    stopwatchStartRef.current = Date.now() - stopwatch * 1000;
    setStopwatchRunning(true);
  };

  const resetCurrent = () => {
    if (view === "stopwatch") {
      setStopwatchRunning(false);
      setStopwatch(0);
      setLaps([]);
      return;
    }
    resetCountdown();
  };

  useEffect(() => {
    if (!running || !endAt) return;
    const tick = () => {
      const next = timerRemaining(endAt, Date.now());
      setRemaining(next);
      if (next || completionRef.current) return;
      completionRef.current = true;
      setRunning(false);
      setEndAt(null);
      if (view === "focus" && preset === "focus") saveSession(total);
      playNovaSound("success");
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [endAt, preset, running, total, view]);

  useEffect(() => {
    if (!stopwatchRunning) return;
    const tick = () => setStopwatch(Math.floor((Date.now() - stopwatchStartRef.current) / 1000));
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [stopwatchRunning]);

  useEffect(() => {
    if (!active) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        if (view === "stopwatch") toggleStopwatch();
        else toggleCountdown();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetCurrent();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return <main className="focus-clock">
    <header className="focus-clock-header">
      <div><strong>专注时钟</strong><span>本地计时与专注记录</span></div>
      <nav aria-label="时钟模式">
        <button className={view === "focus" ? "active" : ""} onClick={() => chooseView("focus")}>番茄钟</button>
        <button className={view === "timer" ? "active" : ""} onClick={() => chooseView("timer")}>倒计时</button>
        <button className={view === "stopwatch" ? "active" : ""} onClick={() => chooseView("stopwatch")}>秒表</button>
      </nav>
    </header>
    <section className="focus-clock-body">
      <div className="focus-timer">
        {view === "focus" && <div className="focus-presets" role="group" aria-label="番茄钟阶段">{FOCUS_PRESETS.map((item) => <button key={item.id} className={preset === item.id ? "active" : ""} aria-pressed={preset === item.id} onClick={() => choosePreset(item.id)}>{item.label}</button>)}</div>}
        {view === "timer" && <label className="timer-duration"><span>分钟</span><input type="number" min="1" max="180" value={timerMinutes} disabled={running} onChange={(event) => { const value = Math.max(1, Math.min(180, Number(event.target.value) || 1)); setTimerMinutes(value); resetCountdown(value * 60); }}/></label>}
        <div className={`focus-dial ${running || stopwatchRunning ? "running" : ""}`} style={{ "--clock-progress": `${progress * 360}deg` } as React.CSSProperties}>
          <div><small>{view === "focus" ? FOCUS_PRESETS.find((item) => item.id === preset)?.label : view === "timer" ? "倒计时" : "秒表"}</small><strong>{formatClockDuration(view === "stopwatch" ? stopwatch : remaining)}</strong><span>{view === "stopwatch" ? `${laps.length} 次计次` : running ? "进行中" : remaining === 0 ? "已完成" : "已暂停"}</span></div>
        </div>
        <div className="focus-controls">
          <button className="reset" aria-label="重置" title="重置" onClick={resetCurrent}>↻</button>
          <button className="primary" aria-label={view === "stopwatch" ? stopwatchRunning ? "暂停秒表" : "开始秒表" : running ? "暂停计时" : "开始计时"} onClick={view === "stopwatch" ? toggleStopwatch : toggleCountdown}>{view === "stopwatch" ? stopwatchRunning ? "暂停" : "开始" : running ? "暂停" : "开始"}</button>
          <button className="lap" disabled={view !== "stopwatch" || !stopwatchRunning} onClick={() => setLaps((current) => [stopwatch, ...current].slice(0, 8))}>计次</button>
        </div>
      </div>
      <aside className="focus-insights">
        <section className="focus-summary"><header><strong>专注概览</strong><span>仅保存在本机</span></header><div><article><b>{stats.todaySessions}</b><span>今日次数</span></article><article><b>{stats.todayMinutes}</b><span>今日分钟</span></article><article><b>{stats.weekMinutes}</b><span>本周分钟</span></article></div></section>
        <section className="focus-history"><header><strong>{view === "stopwatch" ? "计次" : "最近专注"}</strong>{view === "stopwatch" ? <span>{laps.length} 条</span> : sessions.length ? <button onClick={() => { setSessions([]); localStorage.removeItem(SESSION_KEY); }}>清除</button> : <span>{stats.weekSessions} 次</span>}</header>{view === "stopwatch" ? <div>{laps.length ? laps.map((lap, index) => <p key={`${lap}-${index}`}><span>#{laps.length - index}</span><strong>{formatClockDuration(lap)}</strong></p>) : <p className="empty">暂无计次</p>}</div> : <div>{sessions.length ? sessions.slice(0, 6).map((session) => <p key={session.endedAt}><span>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(session.endedAt)}</span><strong>{Math.round(session.duration / 60)} 分钟</strong></p>) : <p className="empty">完成一次专注后显示记录</p>}</div>}</section>
      </aside>
    </section>
  </main>;
}
