import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetAllGameData,
  saveGameProgress,
  subscribeGameRecords,
  subscribeGameReset,
  type GameId,
} from "../../src/apps/games/shared/gameStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("window", new EventTarget());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resetAllGameData", () => {
  it("clears records, progress, and mines auxiliary data while preserving unrelated settings", () => {
    const gameIds: GameId[] = ["mines", "chess", "gomoku", "tower", "youtd2", "wolfslot"];
    for (const id of gameIds) saveGameProgress(id, { board: id });
    localStorage.setItem("nova-mines-difficulty", "expert");
    localStorage.setItem("nova-mines-best", JSON.stringify({ expert: 42 }));
    localStorage.setItem("nova-game-coins", "120");
    localStorage.setItem("nova-game-progress:removed-game", JSON.stringify({ board: "stale" }));
    localStorage.setItem("nova-settings", JSON.stringify({ theme: "dark" }));

    const resetListeners = {
      mines: vi.fn<() => void>(),
      chess: vi.fn<() => void>(),
      gomoku: vi.fn<() => void>(),
      tower: vi.fn<() => void>(),
      youtd2: vi.fn<() => void>(),
      wolfslot: vi.fn<() => void>(),
    } satisfies Record<GameId, () => void>;
    const unsubscribe = gameIds.map((id) => subscribeGameReset(id, resetListeners[id]));
    const unsubscribeRecreatingListener = subscribeGameReset("mines", () => {
      localStorage.setItem("nova-mines-difficulty", "beginner");
      saveGameProgress("mines", { board: "reset" });
    });
    const recordsListener = vi.fn();
    const unsubscribeRecords = subscribeGameRecords(recordsListener);

    resetAllGameData();

    expect(localStorage.getItem("nova-game-records")).toBeNull();
    for (const id of gameIds) {
      expect(localStorage.getItem(`nova-game-progress:${id}`)).toBeNull();
      expect(resetListeners[id]).toHaveBeenCalledOnce();
    }
    expect(localStorage.getItem("nova-mines-difficulty")).toBeNull();
    expect(localStorage.getItem("nova-mines-best")).toBeNull();
    expect(localStorage.getItem("nova-game-coins")).toBeNull();
    expect(localStorage.getItem("nova-game-progress:removed-game")).toBeNull();
    expect(localStorage.getItem("nova-settings")).not.toBeNull();
    expect(recordsListener).toHaveBeenCalled();

    unsubscribe.forEach((removeListener) => removeListener());
    unsubscribeRecreatingListener();
    unsubscribeRecords();
  });
});
