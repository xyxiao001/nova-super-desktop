"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { subscribeNovaActivityEvents } from "../../../app/activityEvents";
import {
  DEFAULT_PET_POSITION,
  createPetData,
  reducePetData,
  restorePetState,
  type PetData,
  type PetPersonality,
  type PetPreferences,
  type PetProfile,
} from "../../../app/petModel";
import {
  clearPetData,
  loadPetData,
  savePetData,
  savePetPreferences,
  savePetRuntime,
} from "../../../app/petStorage";

export type PetRuntimeValue = {
  data: PetData | null;
  status: "loading" | "ready" | "error";
  createPet: (name: string, personality: PetPersonality) => Promise<void>;
  updateProfile: (patch: Pick<PetProfile, "name" | "personality">) => Promise<void>;
  updatePreferences: (patch: Partial<PetPreferences>) => Promise<void>;
  setPosition: (x: number, y: number) => Promise<void>;
  resetPosition: () => Promise<void>;
  setHidden: (hidden: boolean) => Promise<void>;
  clearPet: () => Promise<void>;
};

const PetRuntimeContext = createContext<PetRuntimeValue | null>(null);

export function PetRuntimeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PetData | null>(null);
  const [status, setStatus] = useState<PetRuntimeValue["status"]>("loading");

  useEffect(() => {
    let cancelled = false;
    void loadPetData()
      .then(async (stored) => {
        if (cancelled) return;
        if (!stored) {
          setStatus("ready");
          return;
        }
        const restoredState = restorePetState(stored.state);
        const restored = restoredState === stored.state
          ? stored
          : { ...stored, state: restoredState };
        setData(restored);
        setStatus("ready");
        if (restored !== stored) await savePetRuntime(restored.state, restored.memory);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeNovaActivityEvents((event) => {
    setData((current) => {
      if (!current?.preferences.enabled) return current;
      const next = reducePetData(current, event);
      void savePetRuntime(next.state, next.memory).catch(() => setStatus("error"));
      return next;
    });
  }), []);

  const createPet = useCallback(async (
    name: string,
    personality: PetPersonality,
  ) => {
    const next = createPetData({ name, personality });
    await savePetData(next);
    setData(next);
    setStatus("ready");
  }, []);

  const updateProfile = useCallback(async (
    patch: Pick<PetProfile, "name" | "personality">,
  ) => {
    if (!data) return;
    const next = {
      ...data,
      profile: {
        ...data.profile,
        name: patch.name.trim(),
        personality: patch.personality,
      },
    };
    await savePetData(next);
    setData(next);
  }, [data]);

  const updatePreferences = useCallback(async (
    patch: Partial<PetPreferences>,
  ) => {
    if (!data) return;
    const preferences = { ...data.preferences, ...patch };
    await savePetPreferences(preferences);
    setData({ ...data, preferences });
  }, [data]);

  const setPosition = useCallback(async (x: number, y: number) => {
    if (!data) return;
    const state = { ...data.state, x, y, lastActiveAt: Date.now() };
    await savePetRuntime(state, data.memory);
    setData({ ...data, state });
  }, [data]);

  const resetPosition = useCallback(async () => {
    if (!data) return;
    const state = {
      ...data.state,
      ...DEFAULT_PET_POSITION,
      hidden: false,
      lastActiveAt: Date.now(),
    };
    await savePetRuntime(state, data.memory);
    setData({ ...data, state });
  }, [data]);

  const setHidden = useCallback(async (hidden: boolean) => {
    if (!data) return;
    const state = { ...data.state, hidden, lastActiveAt: Date.now() };
    await savePetRuntime(state, data.memory);
    setData({ ...data, state });
  }, [data]);

  const clearPet = useCallback(async () => {
    await clearPetData();
    setData(null);
    setStatus("ready");
  }, []);

  const value = useMemo<PetRuntimeValue>(() => ({
    data,
    status,
    createPet,
    updateProfile,
    updatePreferences,
    setPosition,
    resetPosition,
    setHidden,
    clearPet,
  }), [
    clearPet,
    createPet,
    data,
    resetPosition,
    setHidden,
    setPosition,
    status,
    updatePreferences,
    updateProfile,
  ]);

  return <PetRuntimeContext.Provider value={value}>{children}</PetRuntimeContext.Provider>;
}

export function usePetRuntime() {
  const runtime = useContext(PetRuntimeContext);
  if (!runtime) throw new Error("PetRuntimeProvider is missing");
  return runtime;
}
