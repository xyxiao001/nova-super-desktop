"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WindowAppId } from "./appRegistry";
import type { DesktopFocus, WindowStateMap } from "./windowState";

export type AppRuntimeValue = {
  windows: WindowStateMap;
  focused: DesktopFocus;
  openApp: (app: WindowAppId) => void;
  isAppActive: (app: WindowAppId) => boolean;
};

const AppRuntimeContext = createContext<AppRuntimeValue | null>(null);

export const appIsActive = (
  windows: WindowStateMap,
  focused: DesktopFocus,
  app: WindowAppId,
) => focused === app && windows[app].open && !windows[app].minimized;

export function AppRuntimeProvider({
  value,
  children,
}: {
  value: AppRuntimeValue;
  children: ReactNode;
}) {
  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime() {
  return useContext(AppRuntimeContext)!;
}
