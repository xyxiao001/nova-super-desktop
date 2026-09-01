import { describe, expect, it } from "vitest";

import { createCalendarAlmanac } from "../../src/apps/calendar/calendarAlmanac";

describe("calendar almanac", () => {
  it("derives the traditional almanac for a solar date", () => {
    const result = createCalendarAlmanac(2026, 8, 31);

    expect(result).toMatchObject({
      lunarDate: "二〇二六年七月十九",
      ganZhi: "丙午年 丙申月 丁丑日",
      zodiac: "马",
      dayOfficer: "执日",
      daySpirit: "明堂",
      dayLuck: "吉",
      mansion: "危宿",
      mansionLuck: "凶",
      clash: "冲(辛未)羊",
      sha: "煞东",
    });
    expect(result.yi).toContain("祭祀");
    expect(result.ji).toContain("嫁娶");
  });

  it("includes solar terms and lunar festivals when present", () => {
    expect(createCalendarAlmanac(2026, 9, 7).solarTerm).toBe("白露");
    expect(createCalendarAlmanac(2026, 2, 17).festivals).toContain("春节");
  });
});
