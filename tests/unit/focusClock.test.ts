import { describe, expect, it } from "vitest";

import {
  appendFocusSession,
  focusSessionStats,
  formatClockDuration,
  timerProgress,
  timerRemaining,
} from "../../src/apps/focus/focusClock";

describe("focus clock", () => {
  it("formats short and long durations", () => {
    expect(formatClockDuration(65)).toBe("01:05");
    expect(formatClockDuration(3661)).toBe("01:01:01");
  });

  it("derives drift-resistant remaining time and progress", () => {
    expect(timerRemaining(12_500, 10_000)).toBe(3);
    expect(timerRemaining(9_000, 10_000)).toBe(0);
    expect(timerProgress(100, 25)).toBe(.75);
  });

  it("limits history and aggregates daily and weekly focus", () => {
    const now = new Date(2026, 7, 28, 12);
    const today = now.getTime() - 60_000;
    const earlierThisWeek = now.getTime() - 2 * 24 * 60 * 60 * 1000;
    const sessions = appendFocusSession(
      [{ endedAt: earlierThisWeek, duration: 1800 }],
      { endedAt: today, duration: 1500 },
      2,
    );

    expect(focusSessionStats(sessions, now)).toEqual({
      todaySessions: 1,
      todayMinutes: 25,
      weekSessions: 2,
      weekMinutes: 55,
    });
  });
});
