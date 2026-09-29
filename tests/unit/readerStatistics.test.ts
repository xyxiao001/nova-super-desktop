import { afterEach, describe, expect, it, vi } from "vitest";
import { READING_BREAK_MS, readingDay, readingDuration, recordReadingTime, startReadingClock, summarizeReading } from "../../src/apps/reader/readingStats";

const start = new Date(2026, 8, 29, 10).getTime();
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("reading statistics", () => {
  it("accumulates per-book time without changing previous statistics", () => {
    const empty = { days: {} };
    const first = recordReadingTime(empty, "xian-ni", start, start + 60_000);
    const next = recordReadingTime(first, "three-body", start + 60_000, start + 180_000);
    expect(empty.days).toEqual({});
    expect(summarizeReading(first, start, "xian-ni").total).toBe(60_000);
    expect(summarizeReading(next, start, "xian-ni")).toEqual({ today:180_000, total:180_000, days:1, book:60_000 });
  });

  it("splits a session across local midnight", () => {
    const from = new Date(2026, 8, 29, 23, 59, 50).getTime();
    const stats = recordReadingTime({ days:{} }, "xian-ni", from, from + 30_000);
    expect(stats.days[readingDay(from)]["xian-ni"]).toBe(10_000);
    expect(summarizeReading(stats, from + 30_000, "xian-ni")).toEqual({ today:20_000, total:30_000, days:2, book:30_000 });
  });

  it("formats reading time without claiming a full minute for a few seconds", () => {
    expect(readingDuration(0)).toBe("0 分钟");
    expect(readingDuration(15000)).toBe("不足 1 分钟");
    expect(readingDuration(READING_BREAK_MS)).toBe("30 分钟");
    expect(readingDuration(3_660_000)).toBe("1 小时 1 分钟");
  });

  it("pauses hidden tabs, records the final partial tick, and releases timers", () => {
    vi.useFakeTimers(); vi.setSystemTime(start);
    const doc = Object.assign(new EventTarget(), { visibilityState:"visible", hasFocus:() => true });
    const win = Object.assign(new EventTarget(), { setInterval, clearInterval });
    vi.stubGlobal("document", doc); vi.stubGlobal("window", win);
    let elapsed = 0;
    const stop = startReadingClock((from, to) => { elapsed += to - from; });
    vi.advanceTimersByTime(20_000);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(elapsed).toBe(20_000);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(READING_BREAK_MS);
    expect(elapsed).toBe(20_000);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(7_000);
    stop();
    expect(elapsed).toBe(27_000);
    win.dispatchEvent(new Event("focus"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not count browser blur or pagehide and reaches the break threshold using reading time", () => {
    vi.useFakeTimers(); vi.setSystemTime(start);
    const doc = Object.assign(new EventTarget(), { visibilityState:"visible", hasFocus:() => true });
    const win = Object.assign(new EventTarget(), { setInterval, clearInterval });
    vi.stubGlobal("document", doc); vi.stubGlobal("window", win);
    let elapsed = 0;
    const stop = startReadingClock((from, to) => { elapsed += to - from; });
    vi.advanceTimersByTime(READING_BREAK_MS - 15_000);
    expect(elapsed).toBeLessThan(READING_BREAK_MS);
    win.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(60_000);
    win.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(15_000);
    expect(elapsed).toBe(READING_BREAK_MS);
    win.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(60_000);
    expect(elapsed).toBe(READING_BREAK_MS);
    stop();
  });
});
