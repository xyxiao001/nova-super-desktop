export const DEFAULT_GAME_COINS = 500;

const GAME_COINS_KEY = "nova-game-coins";
const GAME_COINS_CHANGE_EVENT = "nova-game-coins-change";

export const readGameCoins = () => {
  if (typeof window === "undefined") return DEFAULT_GAME_COINS;
  const saved = localStorage.getItem(GAME_COINS_KEY);
  return saved === null ? DEFAULT_GAME_COINS : Number(saved);
};

const writeGameCoins = (coins: number) => {
  localStorage.setItem(GAME_COINS_KEY, String(coins));
  window.dispatchEvent(new CustomEvent(GAME_COINS_CHANGE_EVENT));
  return coins;
};

export const spendGameCoins = (amount: number) => {
  const coins = readGameCoins();
  if (coins < amount) return false;
  writeGameCoins(coins - amount);
  return true;
};

export const awardGameCoins = (amount: number) => writeGameCoins(readGameCoins() + amount);
export const resetGameCoins = () => writeGameCoins(DEFAULT_GAME_COINS);
export const subscribeGameCoins = (listener: () => void) => {
  window.addEventListener(GAME_COINS_CHANGE_EVENT, listener);
  return () => window.removeEventListener(GAME_COINS_CHANGE_EVENT, listener);
};
