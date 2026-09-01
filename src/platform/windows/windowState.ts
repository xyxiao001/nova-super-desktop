import { REGISTERED_APPS, type WindowAppId } from "../apps/appRegistry";
import type { WindowSnapMode } from "./windowGeometry";

export type DesktopFocus = "desktop" | WindowAppId;

export type WindowState = {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  z: number;
  snapMode?: WindowSnapMode;
};

export type WindowStateMap = Record<WindowAppId, WindowState>;

export type WindowManagerState = {
  windows: WindowStateMap;
  focused: DesktopFocus;
  nextZ: number;
};

export type WindowAction =
  | { type: "open"; app: WindowAppId }
  | { type: "focus"; app: WindowAppId }
  | { type: "focus-desktop" }
  | { type: "close"; app: WindowAppId }
  | { type: "dismiss"; app: WindowAppId }
  | { type: "minimize"; app: WindowAppId }
  | { type: "toggle-maximize"; app: WindowAppId }
  | { type: "snap"; app: WindowAppId; mode: WindowSnapMode }
  | { type: "update"; app: WindowAppId; patch: Partial<WindowState> };

export function createInitialWindowManagerState(): WindowManagerState {
  return {
    windows: Object.fromEntries(REGISTERED_APPS.map((app) => [app.id, {
      open: false,
      minimized: false,
      maximized: false,
      z: 0,
    }])) as WindowStateMap,
    focused: "desktop",
    nextZ: 1,
  };
}

export function topWindow(
  windows: WindowStateMap,
  exclude?: WindowAppId,
): DesktopFocus {
  return REGISTERED_APPS
    .filter((app) => app.id !== exclude && windows[app.id].open && !windows[app.id].minimized)
    .sort((left, right) => windows[right.id].z - windows[left.id].z)[0]?.id
    ?? "desktop";
}

const patchWindow = (
  state: WindowManagerState,
  app: WindowAppId,
  patch: Partial<WindowState>,
): WindowManagerState => ({
  ...state,
  windows: {
    ...state.windows,
    [app]: { ...state.windows[app], ...patch },
  },
});

export function windowReducer(
  state: WindowManagerState,
  action: WindowAction,
): WindowManagerState {
  if (action.type === "focus-desktop") return { ...state, focused: "desktop" };

  if (action.type === "open" || action.type === "focus") {
    const z = state.nextZ + 1;
    const patch = action.type === "open"
      ? { open: true, minimized: false, z }
      : { z };
    return {
      ...patchWindow(state, action.app, patch),
      focused: action.app,
      nextZ: z,
    };
  }

  if (action.type === "close") {
    return {
      ...patchWindow(state, action.app, { open: false }),
      focused: topWindow(state.windows, action.app),
    };
  }

  if (action.type === "dismiss") {
    return patchWindow(state, action.app, { open: false });
  }

  if (action.type === "minimize") {
    return {
      ...patchWindow(state, action.app, { minimized: true }),
      focused: topWindow(state.windows, action.app),
    };
  }

  if (action.type === "toggle-maximize") {
    return patchWindow(state, action.app, {
      maximized: !state.windows[action.app].maximized,
      snapMode: undefined,
    });
  }

  if (action.type === "snap") {
    return {
      ...patchWindow(state, action.app, {
        maximized: false,
        minimized: false,
        snapMode: action.mode,
      }),
      focused: action.app,
    };
  }

  return patchWindow(state, action.app, action.patch);
}
