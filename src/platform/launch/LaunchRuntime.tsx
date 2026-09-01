"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  launchIntentFor,
  type AppLaunchIntent,
  type AppLaunchTarget,
} from "../../../app/appLaunch";

export type LaunchRuntimeValue = {
  intent: AppLaunchIntent | null;
  markHandled: (requestId: number) => void;
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
  return {
    launchIntent: launchIntentFor(runtime.intent, app),
    onLaunchHandled: runtime.markHandled,
  };
}
