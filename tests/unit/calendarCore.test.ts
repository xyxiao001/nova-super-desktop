import { describe, expect, it } from "vitest";

import {
  HOLIDAY_SCHEDULES_2026,
  holidayDateInfo,
  holidayRangeLabel,
  holidayScheduleForDate,
  holidayWorkdayLabel,
  lunarDate,
  nextHoliday,
  toIsoDate,
} from "../../src/apps/calendar/calendarCore";

describe("2026 calendar data", () => {
  it("contains every official holiday and adjusted workday", () => {
    const holidays = HOLIDAY_SCHEDULES_2026.flatMap((schedule) => schedule.days);
    const workdays = HOLIDAY_SCHEDULES_2026.flatMap((schedule) => schedule.workdays);

    expect(holidays).toHaveLength(33);
    expect(workdays).toHaveLength(6);
    expect(holidayDateInfo("2026-01-01")).toEqual({ name: "元旦", type: "holiday" });
    expect(holidayDateInfo("2026-01-04")).toEqual({ name: "元旦", type: "workday" });
  });

  it("links a holiday and its adjusted workdays to one schedule", () => {
    const springFestival = holidayScheduleForDate("2026-02-28");

    expect(springFestival?.name).toBe("春节");
    expect(holidayRangeLabel(springFestival!)).toBe("2月15日至2月23日");
    expect(holidayWorkdayLabel(springFestival!)).toBe("2月14日、2月28日");
  });

  it("finds the next holiday without timezone drift", () => {
    expect(nextHoliday("2026-08-31")).toMatchObject({
      schedule: { name: "中秋节" },
      daysUntil: 25,
    });
    expect(nextHoliday("2026-09-26")).toMatchObject({
      schedule: { name: "中秋节" },
      daysUntil: 0,
    });
    expect(nextHoliday("2026-12-31")).toBeNull();
  });
});

describe("calendar date formatting", () => {
  it("uses local date parts when creating an ISO date", () => {
    expect(toIsoDate(new Date(2026, 0, 4))).toBe("2026-01-04");
  });

  it("formats a Chinese lunar date", () => {
    expect(lunarDate(new Date(2026, 7, 31))).toEqual({
      short: "十九",
      long: "丙午年 七月十九",
    });
  });
});
