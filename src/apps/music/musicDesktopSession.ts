import { useSyncExternalStore } from "react";
import type { MediaCardTheme } from "../../platform/desktop/MediaCardThemes";

type MusicDesktopState = { surface: HTMLDivElement | null; pinned: boolean; theme: MediaCardTheme };
const initialState: MusicDesktopState = { surface: null, pinned: false, theme: "warm" };
export function createMusicDesktopSession() {
  let state = initialState;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<MusicDesktopState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update,
    setSurface: (surface: HTMLDivElement | null) => update({ surface }),
  };
}
export const musicDesktopSession = createMusicDesktopSession();
export const useMusicDesktopSession = () => useSyncExternalStore(musicDesktopSession.subscribe, musicDesktopSession.getSnapshot, () => initialState);
