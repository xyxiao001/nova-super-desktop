"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { WindowAppId } from "../apps/appRegistry";
import type {
  WindowInstanceId,
  WindowInstanceMap,
  WindowInstanceTarget,
} from "./windowInstanceState";

export type WindowRuntimeValue = {
  instances: WindowInstanceMap;
  focused: "desktop" | WindowInstanceId;
  openApp: (app: WindowAppId) => WindowInstanceId;
  openNewWindow: (app: WindowAppId) => WindowInstanceId;
  openResource: (
    app: WindowAppId,
    target: WindowInstanceTarget,
  ) => WindowInstanceId;
  retargetInstance: (
    id: WindowInstanceId,
    target?: WindowInstanceTarget,
  ) => WindowInstanceId;
  focusInstance: (id: WindowInstanceId) => void;
  closeInstance: (id: WindowInstanceId) => void;
  isAppOpen: (app: WindowAppId) => boolean;
  isAppActive: (app: WindowAppId) => boolean;
  isInstanceActive: (id: WindowInstanceId) => boolean;
  setWindowTitle: (
    id: WindowInstanceId,
    title?: string,
    taskbar?: boolean,
  ) => void;
};

type WindowInstanceContextValue = {
  id: WindowInstanceId;
  app: WindowAppId;
  target?: WindowInstanceTarget;
};

const WindowRuntimeContext = createContext<WindowRuntimeValue | null>(null);
const WindowInstanceContext = createContext<WindowInstanceContextValue | null>(null);
const WINDOW_CLOSING_EVENT = "nova-window-closing";

export const notifyWindowClosing = (id: WindowInstanceId) => {
  window.dispatchEvent(new CustomEvent(WINDOW_CLOSING_EVENT, { detail: id }));
};

export const subscribeWindowClosing = (
  id: WindowInstanceId,
  listener: () => void,
) => {
  const handler = (event: Event) => {
    if ((event as CustomEvent<WindowInstanceId>).detail === id) listener();
  };
  window.addEventListener(WINDOW_CLOSING_EVENT, handler);
  return () => window.removeEventListener(WINDOW_CLOSING_EVENT, handler);
};

export const windowIsActive = (
  instances: WindowInstanceMap,
  focused: "desktop" | WindowInstanceId,
  app: WindowAppId,
) => {
  const instance = focused === "desktop" ? undefined : instances[focused];
  return instance?.app === app && !instance.minimized;
};

export function WindowRuntimeProvider({
  value,
  children,
}: {
  value: WindowRuntimeValue;
  children: ReactNode;
}) {
  return <WindowRuntimeContext.Provider value={value}>{children}</WindowRuntimeContext.Provider>;
}

export function WindowInstanceProvider({
  value,
  children,
}: {
  value: WindowInstanceContextValue;
  children: ReactNode;
}) {
  return <WindowInstanceContext.Provider value={value}>{children}</WindowInstanceContext.Provider>;
}

export function useWindowRuntime() {
  return useContext(WindowRuntimeContext)!;
}

export function useWindowInstance() {
  return useContext(WindowInstanceContext)!;
}

export function useWindowTitle(app: WindowAppId, title?: string, taskbar = false) {
  const { setWindowTitle } = useWindowRuntime();
  const instance = useWindowInstance();
  useEffect(() => {
    setWindowTitle(instance.id, title, taskbar);
  }, [app, instance.id, setWindowTitle, taskbar, title]);
}
