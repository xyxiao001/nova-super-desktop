"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  launchIntentFor,
  type AppLaunchIntent,
  type AppLaunchTarget,
} from "../../../app/appLaunch";
import { useWindowInstance } from "../windows/WindowRuntime";
import type { WindowInstanceId } from "../windows/windowInstanceState";

export type LaunchRuntimeValue = {
  intents: Partial<Record<WindowInstanceId, AppLaunchIntent>>;
  markHandled: (instanceId: WindowInstanceId, requestId: number) => void;
};

const LaunchRuntimeContext = createContext<LaunchRuntimeValue | null>(null);

export function LaunchRuntimeProvider({
  value,
  children,
}: {
  value: LaunchRuntimeValue;
  children: ReactNode;
}) {
  return (
    <LaunchRuntimeContext.Provider value={value}>
      {children}
    </LaunchRuntimeContext.Provider>
  );
}

export function useAppLaunchIntent<TApp extends AppLaunchTarget["app"]>(app: TApp) {
  const runtime = useContext(LaunchRuntimeContext)!;
  const instance = useWindowInstance();
  return {
    launchIntent: launchIntentFor(runtime.intents[instance.id] ?? null, app),
    onLaunchHandled: (requestId: number) => runtime.markHandled(instance.id, requestId),
  };
}
