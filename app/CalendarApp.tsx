"use client";

import "./calendar.css";

import { lazy, Suspense, useMemo, useState, type KeyboardEvent } from "react";

import {
  HOLIDAY_DATA_YEAR,
  HOLIDAY_SCHEDULES_2026,
  fromIsoDate,
  holidayDateInfo,
  holidayRangeLabel,
  holidayScheduleForDate,
  holidayWorkdayLabel,
  lunarDate,
  nextHoliday,
  toIsoDate,
} from "./calendarCore";
import { calendarDays } from "./desktopSystem";

const MONTHS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const YEARS = Array.from({ length: 11 }, (_, index) => 2021 + index);
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const LazyCalendarAlmanac = lazy(() => import("./CalendarAlmanacPanel"));
const fullDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "long" });

const dateStatus = (date: Date, isoDate: string) => {
  const official = holidayDateInfo(isoDate);
  if (official?.type === "holiday") return { key: "holiday", label: "休息日" };
  if (official?.type === "workday") return { key: "workday", label: "调休上班" };
  if (date.getDay() === 0 || date.getDay() === 6) return { key: "weekend", label: "周末" };
  return { key: "regular", label: "工作日" };
};

export default function CalendarApp() {
  const [today] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => (
    new Date(today.getFullYear(), today.getMonth(), 1)
  ));
  const [selectedIso, setSelectedIso] = useState(() => toIsoDate(today));
  const [almanacEnabled, setAlmanacEnabled] = useState(false);

  const days = useMemo(() => (
    calendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth(), today, 1)
  ), [today, visibleMonth]);
  const selectedDate = useMemo(() => fromIsoDate(selectedIso), [selectedIso]);
  const selectedHoliday = holidayDateInfo(selectedIso);
  const selectedSchedule = holidayScheduleForDate(selectedIso);
  const selectedLunar = lunarDate(selectedDate);
  const selectedStatus = dateStatus(selectedDate, selectedIso);
  const upcoming = selectedDate.getFullYear() === HOLIDAY_DATA_YEAR
    ? nextHoliday(selectedIso)
    : null;
  const upcomingSchedules = selectedDate.getFullYear() === HOLIDAY_DATA_YEAR
    ? HOLIDAY_SCHEDULES_2026.filter((schedule) => schedule.days.at(-1)! >= selectedIso).slice(0, 3)
    : [];

  const selectDate = (date: Date) => {
    setSelectedIso(toIsoDate(date));
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const moveMonth = (offset: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(next);
    setSelectedIso(toIsoDate(next));
  };

  const chooseYear = (year: number) => {
    const next = new Date(year, visibleMonth.getMonth(), 1);
    setVisibleMonth(next);
    setSelectedIso(toIsoDate(next));
  };

  const chooseMonth = (month: number) => {
    const next = new Date(visibleMonth.getFullYear(), month, 1);
    setVisibleMonth(next);
    setSelectedIso(toIsoDate(next));
  };

  const handleDateKey = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in offsets) {
      event.preventDefault();
      const next = new Date(date);
      next.setDate(next.getDate() + offsets[event.key]);
      selectDate(next);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-calendar-date="${toIsoDate(next)}"]`)?.focus();
      });
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      moveMonth(event.key === "PageUp" ? -1 : 1);
    }
  };

  return <main className="nova-calendar" aria-label="中国日历">
    <header className="calendar-toolbar">
      <div className="calendar-month-picker">
        <select
          aria-label="选择年份"
          value={visibleMonth.getFullYear()}
          onChange={(event) => chooseYear(Number(event.target.value))}
        >
          {YEARS.map((year) => <option key={year} value={year}>{year}年</option>)}
        </select>
        <select
          aria-label="选择月份"
          value={visibleMonth.getMonth()}
          onChange={(event) => chooseMonth(Number(event.target.value))}
        >
          {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
        </select>
      </div>
      <div className="calendar-navigation" aria-label="月份导航">
        <label className="calendar-almanac-toggle">
          <input
            type="checkbox"
            checked={almanacEnabled}
            onChange={(event) => setAlmanacEnabled(event.target.checked)}
          />
          <span>黄历</span>
        </label>
        <button type="button" className="calendar-today-button" onClick={() => selectDate(today)}>今天</button>
        <button type="button" aria-label="上个月" title="上个月" onClick={() => moveMonth(-1)}>‹</button>
        <button type="button" aria-label="下个月" title="下个月" onClick={() => moveMonth(1)}>›</button>
      </div>
    </header>

    <div className="calendar-layout">
      <section className="calendar-month-view" aria-label={`${visibleMonth.getFullYear()}年${visibleMonth.getMonth() + 1}月`}>
        <div className="calendar-app-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day, index) => <span key={day} className={index > 4 ? "weekend" : ""}>{day}</span>)}
        </div>
        <div className="calendar-app-grid">
          {days.map((day) => {
            const date = new Date(day.year, day.month, day.date);
            const official = holidayDateInfo(day.isoDate);
            const status = dateStatus(date, day.isoDate);
            const lunar = lunarDate(date);
            const selected = selectedIso === day.isoDate;
            const subline = official?.name ?? lunar.short;

            return <button
              type="button"
              key={day.key}
              data-calendar-date={day.isoDate}
              className={[
                "calendar-day",
                day.currentMonth ? "" : "outside",
                day.today ? "today" : "",
                selected ? "selected" : "",
                status.key,
              ].filter(Boolean).join(" ")}
              aria-label={`${fullDateFormatter.format(date)}，${weekdayFormatter.format(date)}，${official?.name ?? status.label}`}
              aria-current={day.today ? "date" : undefined}
              aria-pressed={selected}
              onClick={() => selectDate(date)}
              onKeyDown={(event) => handleDateKey(event, date)}
            >
              <span className="calendar-day-number">{day.date}</span>
              <small>{subline}</small>
              {official && <i aria-hidden="true">{official.type === "holiday" ? "休" : "班"}</i>}
            </button>;
          })}
        </div>
        {visibleMonth.getFullYear() !== HOLIDAY_DATA_YEAR && <p className="calendar-data-notice">
          当前仅收录 {HOLIDAY_DATA_YEAR} 年官方节假日安排
        </p>}
      </section>

      <aside className="calendar-details" aria-label="日期详情">
        <section className="calendar-selected-date">
          <span>{fullDateFormatter.format(selectedDate)}</span>
          <div>
            <strong>{selectedDate.getDate()}</strong>
            <p><b>{weekdayFormatter.format(selectedDate)}</b><small>{selectedLunar.long}</small></p>
          </div>
          <mark className={selectedStatus.key}>{selectedStatus.label}</mark>
        </section>

        {selectedSchedule ? <section className="calendar-schedule-detail">
          <header>
            <span>{selectedHoliday?.type === "workday" ? "调休安排" : "法定节假日"}</span>
            <strong>{selectedSchedule.name}</strong>
          </header>
          <dl>
            <div><dt>放假</dt><dd>{holidayRangeLabel(selectedSchedule)}，共 {selectedSchedule.days.length} 天</dd></div>
            <div><dt>补班</dt><dd>{holidayWorkdayLabel(selectedSchedule)}</dd></div>
          </dl>
        </section> : <section className="calendar-schedule-detail quiet">
          <header><span>日期状态</span><strong>{selectedStatus.label}</strong></header>
          <p>{selectedDate.getFullYear() === HOLIDAY_DATA_YEAR
            ? upcoming
              ? `距离${upcoming.schedule.name}还有 ${upcoming.daysUntil} 天`
              : "本年度法定假期已结束"
            : `${HOLIDAY_DATA_YEAR} 年以外仅按自然周显示`}</p>
        </section>}

        {almanacEnabled && <Suspense fallback={<section className="calendar-almanac-loading" aria-live="polite">正在加载黄历...</section>}>
          <LazyCalendarAlmanac date={selectedDate}/>
        </Suspense>}

        <section className="calendar-upcoming">
          <header><strong>接下来</strong><span>{HOLIDAY_DATA_YEAR}</span></header>
          <div>
            {upcomingSchedules.length ? upcomingSchedules.map((schedule) => <button
              type="button"
              key={schedule.name}
              onClick={() => selectDate(fromIsoDate(schedule.days[0]))}
            >
              <time dateTime={schedule.days[0]}>{holidayRangeLabel(schedule)}</time>
              <span><strong>{schedule.name}</strong><small>{schedule.days.length} 天</small></span>
            </button>) : <p>当前日期之后暂无已公布假期</p>}
          </div>
        </section>

        <footer>国务院办公厅 2026 年节假日安排</footer>
      </aside>
    </div>
  </main>;
}
