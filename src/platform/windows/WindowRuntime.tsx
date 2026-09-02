"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { WindowAppId } from "../apps/appRegistry";
import type { DesktopFocus, WindowStateMap } from "./windowState";

export type WindowRuntimeValue = {
  windows: WindowStateMap;
  focused: DesktopFocus;
  windowTitles: Partial<Record<WindowAppId, string>>;
  taskbarTitles: Partial<Record<WindowAppId, string>>;
  openApp: (app: WindowAppId) => void;
  isAppActive: (app: WindowAppId) => boolean;
  setWindowTitle: (app: WindowAppId, title?: string, taskbar?: boolean) => void;
};

const WindowRuntimeContext = createContext<WindowRuntimeValue | null>(null);
const WINDOW_CLOSING_EVENT = "nova-window-closing";

export const notifyWindowClosing = (app: WindowAppId) => {
  window.dispatchEvent(new CustomEvent(WINDOW_CLOSING_EVENT, { detail: app }));
};

export const subscribeWindowClosing = (app: WindowAppId, listener: () => void) => {
  const handler = (event: Event) => {
    if ((event as CustomEvent<WindowAppId>).detail === app) listener();
  };
  window.addEventListener(WINDOW_CLOSING_EVENT, handler);
  return () => window.removeEventListener(WINDOW_CLOSING_EVENT, handler);
};

export const windowIsActive = (
  windows: WindowStateMap,
  focused: DesktopFocus,
  app: WindowAppId,
) => focused === app && windows[app].open && !windows[app].minimized;

export function WindowRuntimeProvider({
  value,
  children,
}: {
  value: WindowRuntimeValue;
  children: ReactNode;
}) {
  return <WindowRuntimeContext.Provider value={value}>{children}</WindowRuntimeContext.Provider>;
}

export function useWindowRuntime() {
  return useContext(WindowRuntimeContext)!;
}

export function useWindowTitle(app: WindowAppId, title?: string, taskbar = false) {
  const runtime = useWindowRuntime();
  useEffect(() => {
    runtime.setWindowTitle(app, title, taskbar);
  }, [app, runtime, taskbar, title]);
}
