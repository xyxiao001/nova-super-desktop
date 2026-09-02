import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  awardGameCoins,
  DEFAULT_GAME_COINS,
  readGameCoins,
  resetGameCoins,
  spendGameCoins,
  subscribeGameCoins,
} from "../../src/apps/games/shared/gameCoins";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("window", new EventTarget());
});

afterEach(() => vi.unstubAllGlobals());

describe("global game coins", () => {
  it("spends and awards one shared balance", () => {
    expect(readGameCoins()).toBe(DEFAULT_GAME_COINS);
    expect(spendGameCoins(80)).toBe(true);
    expect(awardGameCoins(30)).toBe(450);
    expect(readGameCoins()).toBe(450);
  });

  it("does not spend when the shared balance is insufficient", () => {
    expect(spendGameCoins(DEFAULT_GAME_COINS + 1)).toBe(false);
    expect(readGameCoins()).toBe(DEFAULT_GAME_COINS);
  });

  it("resets from outside games and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGameCoins(listener);
    spendGameCoins(200);
    resetGameCoins();
    expect(readGameCoins()).toBe(DEFAULT_GAME_COINS);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
