import { describe, expect, it } from "vitest";

import {
  calendarEventTimeLabel,
  calendarEventsByDate,
  isCalendarEvent,
  normalizeCalendarEventDraft,
  sortCalendarEvents,
  validateCalendarEventDraft,
  type CalendarEvent,
} from "../../src/apps/calendar/calendarEventCore";

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "event-1",
  title: "项目同步",
  date: "2026-09-01",
  allDay: false,
  startTime: "10:00",
  endTime: "11:00",
  color: "teal",
  notes: "",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("calendar event core", () => {
  it("validates timed events and rejects reversed time ranges", () => {
    expect(validateCalendarEventDraft(event())).toBe("");
    expect(validateCalendarEventDraft(event({ endTime: "09:30" }))).toBe("结束时间需要晚于开始时间");
    expect(validateCalendarEventDraft(event({ title: " " }))).toBe("请输入日程名称");
  });

  it("normalizes all-day events without retaining stale times", () => {
    expect(normalizeCalendarEventDraft(event({
      title: "  休息  ",
      notes: "  不安排会议  ",
      allDay: true,
    }))).toMatchObject({
      title: "休息",
      notes: "不安排会议",
      startTime: "",
      endTime: "",
    });
  });

  it("sorts all-day entries before timed entries and groups by date", () => {
    const afternoon = event({ id: "afternoon", startTime: "15:00", endTime: "16:00", createdAt: 3 });
    const allDay = event({ id: "all-day", allDay: true, startTime: "", endTime: "", createdAt: 2 });
    const morning = event({ id: "morning", startTime: "09:00", endTime: "10:00", createdAt: 1 });
    const later = event({ id: "later", date: "2026-09-02" });

    expect(sortCalendarEvents([afternoon, later, allDay, morning]).map((item) => item.id)).toEqual([
      "all-day",
      "morning",
      "afternoon",
      "later",
    ]);
    expect(calendarEventsByDate([afternoon, allDay, morning]).get("2026-09-01")?.map((item) => item.id)).toEqual([
      "all-day",
      "morning",
      "afternoon",
    ]);
  });

  it("validates persisted records and formats their time", () => {
    expect(isCalendarEvent(event())).toBe(true);
    expect(isCalendarEvent(event({ date: "2026-02-30" }))).toBe(false);
    expect(calendarEventTimeLabel(event())).toBe("10:00–11:00");
    expect(calendarEventTimeLabel(event({ allDay: true, startTime: "", endTime: "" }))).toBe("全天");
  });
});
