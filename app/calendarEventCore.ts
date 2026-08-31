export const CALENDAR_EVENT_COLORS = ["teal", "red", "blue", "amber"] as const;

export type CalendarEventColor = typeof CALENDAR_EVENT_COLORS[number];

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  color: CalendarEventColor;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type CalendarEventDraft = Pick<
  CalendarEvent,
  "title" | "date" | "allDay" | "startTime" | "endTime" | "color" | "notes"
>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const isCalendarDate = (value: string) => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
};

export const isCalendarTime = (value: string) => TIME_PATTERN.test(value);

export function validateCalendarEventDraft(draft: CalendarEventDraft) {
  if (!draft.title.trim()) return "请输入日程名称";
  if (!isCalendarDate(draft.date)) return "请选择有效日期";
  if (!CALENDAR_EVENT_COLORS.includes(draft.color)) return "请选择日程颜色";
  if (draft.allDay) return "";
  if (!isCalendarTime(draft.startTime) || !isCalendarTime(draft.endTime)) return "请选择开始和结束时间";
  if (draft.endTime <= draft.startTime) return "结束时间需要晚于开始时间";
  return "";
}

export function normalizeCalendarEventDraft(draft: CalendarEventDraft): CalendarEventDraft {
  return {
    title: draft.title.trim(),
    date: draft.date,
    allDay: draft.allDay,
    notes: draft.notes.trim(),
    startTime: draft.allDay ? "" : draft.startTime,
    endTime: draft.allDay ? "" : draft.endTime,
    color: draft.color,
  };
}

export const isCalendarEvent = (value: unknown): value is CalendarEvent => {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CalendarEvent>;
  if (
    typeof event.id !== "string"
    || typeof event.title !== "string"
    || typeof event.date !== "string"
    || typeof event.allDay !== "boolean"
    || typeof event.startTime !== "string"
    || typeof event.endTime !== "string"
    || typeof event.color !== "string"
    || typeof event.notes !== "string"
    || typeof event.createdAt !== "number"
    || typeof event.updatedAt !== "number"
  ) return false;
  return (
    Number.isFinite(event.createdAt)
    && Number.isFinite(event.updatedAt)
    && !validateCalendarEventDraft(event as CalendarEventDraft)
  );
};

export function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort((left, right) => (
    left.date.localeCompare(right.date)
    || Number(right.allDay) - Number(left.allDay)
    || left.startTime.localeCompare(right.startTime)
    || left.createdAt - right.createdAt
  ));
}

export function calendarEventsByDate(events: CalendarEvent[]) {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of sortCalendarEvents(events)) {
    const group = byDate.get(event.date);
    if (group) group.push(event);
    else byDate.set(event.date, [event]);
  }
  return byDate;
}

export const calendarEventTimeLabel = (event: CalendarEvent) => (
  event.allDay ? "全天" : `${event.startTime}–${event.endTime}`
);
