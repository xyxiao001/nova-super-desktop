export type HolidaySchedule = {
  name: string;
  days: readonly string[];
  workdays: readonly string[];
};

export type HolidayDateInfo = {
  name: string;
  type: "holiday" | "workday";
};

export const HOLIDAY_DATA_YEAR = 2026;
export const HOLIDAY_SOURCE_URL = "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm";

export const HOLIDAY_SCHEDULES_2026: readonly HolidaySchedule[] = [
  {
    name: "元旦",
    days: ["2026-01-01", "2026-01-02", "2026-01-03"],
    workdays: ["2026-01-04"],
  },
  {
    name: "春节",
    days: [
      "2026-02-15",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
      "2026-02-19",
      "2026-02-20",
      "2026-02-21",
      "2026-02-22",
      "2026-02-23",
    ],
    workdays: ["2026-02-14", "2026-02-28"],
  },
  {
    name: "清明节",
    days: ["2026-04-04", "2026-04-05", "2026-04-06"],
    workdays: [],
  },
  {
    name: "劳动节",
    days: ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05"],
    workdays: ["2026-05-09"],
  },
  {
    name: "端午节",
    days: ["2026-06-19", "2026-06-20", "2026-06-21"],
    workdays: [],
  },
  {
    name: "中秋节",
    days: ["2026-09-25", "2026-09-26", "2026-09-27"],
    workdays: [],
  },
  {
    name: "国庆节",
    days: [
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ],
    workdays: ["2026-09-20", "2026-10-10"],
  },
] as const;

const holidayDates = new Map<string, HolidayDateInfo>();

for (const schedule of HOLIDAY_SCHEDULES_2026) {
  schedule.days.forEach((date) => holidayDates.set(date, { name: schedule.name, type: "holiday" }));
  schedule.workdays.forEach((date) => holidayDates.set(date, { name: schedule.name, type: "workday" }));
}

const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const LUNAR_DAYS = [
  "",
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

export const toIsoDate = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

export const fromIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const holidayDateInfo = (date: string) => holidayDates.get(date);

export const holidayScheduleForDate = (date: string) => (
  HOLIDAY_SCHEDULES_2026.find((schedule) => (
    schedule.days.includes(date) || schedule.workdays.includes(date)
  ))
);

export const lunarDate = (date: Date) => {
  const parts = lunarFormatter.formatToParts(date);
  const yearName = parts.find((part) => String(part.type) === "yearName")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const dayName = LUNAR_DAYS[day] ?? String(day);

  return {
    short: day === 1 ? month : dayName,
    long: `${yearName ? `${yearName}年 ` : ""}${month}${dayName}`,
  };
};

const utcDay = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

export const nextHoliday = (date: string) => {
  const schedule = HOLIDAY_SCHEDULES_2026.find((item) => item.days.at(-1)! >= date);
  if (!schedule) return null;
  const start = schedule.days[0];
  const daysUntil = start <= date ? 0 : Math.round((utcDay(start) - utcDay(date)) / 86_400_000);
  return { schedule, daysUntil };
};

const compactDate = (value: string) => {
  const [, month, day] = value.split("-").map(Number);
  return `${month}月${day}日`;
};

export const holidayRangeLabel = (schedule: HolidaySchedule) => {
  const start = compactDate(schedule.days[0]);
  const end = compactDate(schedule.days.at(-1)!);
  return start === end ? start : `${start}至${end}`;
};

export const holidayWorkdayLabel = (schedule: HolidaySchedule) => (
  schedule.workdays.length
    ? schedule.workdays.map(compactDate).join("、")
    : "无调休补班"
);
