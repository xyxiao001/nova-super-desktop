export type FocusSession = {
  endedAt: number;
  duration: number;
};

export function formatClockDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function timerRemaining(endAt: number, now: number) {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

export function timerProgress(total: number, remaining: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (total - remaining) / total));
}

export function focusDurationBucket(totalSeconds: number) {
  if (totalSeconds < 25 * 60) return "short" as const;
  if (totalSeconds < 50 * 60) return "medium" as const;
  return "long" as const;
}

export function appendFocusSession(
  sessions: FocusSession[],
  session: FocusSession,
  limit = 60,
) {
  return [session, ...sessions].slice(0, limit);
}

export function focusSessionStats(sessions: FocusSession[], now = new Date()) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = dayStart - ((now.getDay() + 6) % 7) * 24 * 60 * 60 * 1000;
  const today = sessions.filter((session) => session.endedAt >= dayStart);
  const week = sessions.filter((session) => session.endedAt >= weekStart);
  return {
    todaySessions: today.length,
    todayMinutes: Math.round(today.reduce((sum, session) => sum + session.duration, 0) / 60),
    weekSessions: week.length,
    weekMinutes: Math.round(week.reduce((sum, session) => sum + session.duration, 0) / 60),
  };
}
