import { useSyncExternalStore } from "react";

type PlaybackStatus = "idle" | "connecting" | "playing" | "paused" | "error";
export const STATUS_LABELS: Record<PlaybackStatus, string> = {
  idle: "等待收听", connecting: "正在连接", playing: "正在直播", paused: "已暂停", error: "暂时无法播放此电台",
};
export type RadioSessionState = {
  stationIndex: number;
  requested: boolean;
  status: PlaybackStatus;
  volume: number;
  pinned: boolean;
};
const initialState: RadioSessionState = { stationIndex: 0, requested: false, status: "idle", volume: 70, pinned: false };

export function createRadioSession() {
  let state = initialState;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<RadioSessionState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update,
    tune: (stationIndex: number) => update({ stationIndex, ...(stationIndex !== state.stationIndex || !state.requested ? { requested: true, status: "connecting" as const } : {}) }),
    togglePlayback: () => update({ requested: !state.requested, status: state.requested ? "paused" : "connecting" }),
    releaseWindow: () => { if (!state.pinned) update({ requested: false, status: "idle" }); },
  };
}
export const radioSession = createRadioSession();
export const useRadioSession = () => useSyncExternalStore(radioSession.subscribe, radioSession.getSnapshot, () => initialState);
