"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { NovaSettings } from "../../../app/novaSettings";

export type SettingsRuntimeValue = {
  settings: NovaSettings;
  updateSettings: (next: NovaSettings) => void;
};

const SettingsRuntimeContext = createContext<SettingsRuntimeValue | null>(null);

export function SettingsRuntimeProvider({
  value,
  children,
}: {
  value: SettingsRuntimeValue;
  children: ReactNode;
}) {
  return (
    <SettingsRuntimeContext.Provider value={value}>
      {children}
    </SettingsRuntimeContext.Provider>
  );
}

export function useSettingsRuntime() {
  return useContext(SettingsRuntimeContext)!;
}
