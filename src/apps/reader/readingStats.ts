export const READING_STATS_KEY = "nova-reader-statistics";
export const READING_BREAK_MS = 30 * 60_000;
export type ReadingStats = { days: Record<string, Record<string, number>> };

export const readingDay = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function readReadingStats(): ReadingStats {
  const saved = localStorage.getItem(READING_STATS_KEY);
  return saved === null ? { days: {} } : JSON.parse(saved);
}

export function recordReadingTime(stats: ReadingStats, bookId: string, from: number, to: number): ReadingStats {
  const days = { ...stats.days };
  let cursor = from;
  while (cursor < to) {
    const midnight = new Date(cursor);
    midnight.setHours(24, 0, 0, 0);
    const end = Math.min(to, midnight.getTime());
    const day = readingDay(cursor);
    const books = days[day] ?? {};
    days[day] = { ...books, [bookId]: (books[bookId] ?? 0) + end - cursor };
    cursor = end;
  }
  return { days };
}

export function summarizeReading(stats: ReadingStats, now: number, bookId?: string) {
  const days = Object.values(stats.days);
  return {
    today: Object.values(stats.days[readingDay(now)] ?? {}).reduce((sum, ms) => sum + ms, 0),
    total: days.reduce((sum, books) => sum + Object.values(books).reduce((a, b) => a + b, 0), 0),
    days: days.length,
    book: bookId ? days.reduce((sum, books) => sum + (books[bookId] ?? 0), 0) : 0,
  };
}

export function readingDuration(ms: number) {
  if (ms < 60_000) return ms > 0 ? "不足 1 分钟" : "0 分钟";
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

// Only mounted while a book is open and the reader window is active.
export function startReadingClock(onElapsed: (from: number, to: number) => void) {
  let started: number | null = null;
  let timer: number | undefined;
  const flush = () => {
    if (started === null) return;
    const now = Date.now();
    if (now > started) onElapsed(started, now);
    started = now;
  };
  const pause = () => {
    flush();
    started = null;
    window.clearInterval(timer);
    timer = undefined;
  };
  const updateVisibility = () => {
    pause();
    if (document.visibilityState === "visible" && document.hasFocus()) {
      started = Date.now();
      timer = window.setInterval(flush, 15_000);
    }
  };
  updateVisibility();
  document.addEventListener("visibilitychange", updateVisibility);
  window.addEventListener("focus", updateVisibility);
  window.addEventListener("blur", pause);
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", updateVisibility);
  return () => {
    pause();
    document.removeEventListener("visibilitychange", updateVisibility);
    window.removeEventListener("focus", updateVisibility);
    window.removeEventListener("blur", pause);
    window.removeEventListener("pagehide", pause);
    window.removeEventListener("pageshow", updateVisibility);
  };
}
