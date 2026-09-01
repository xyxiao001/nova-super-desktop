"use client";

import { useMemo } from "react";

import { createCalendarAlmanac } from "./calendarAlmanac";

export default function CalendarAlmanacPanel({ date }: { date: Date }) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const almanac = useMemo(
    () => createCalendarAlmanac(year, month, day),
    [day, month, year],
  );
  const observances = [almanac.solarTerm, ...almanac.festivals].filter(Boolean);

  return <section className="calendar-almanac" aria-label="黄历">
    <header>
      <div><span>传统黄历</span><strong>{almanac.lunarDate}</strong></div>
      <mark className={almanac.dayLuck === "吉" ? "auspicious" : "inauspicious"}>
        {almanac.daySpirit} · {almanac.dayLuck}
      </mark>
    </header>

    <p className="calendar-almanac-ganzhi">
      <span>{almanac.ganZhi}</span>
      <b>属{almanac.zodiac}</b>
    </p>

    {!!observances.length && <p className="calendar-almanac-observances">
      {observances.join(" · ")}
    </p>}

    <div className="calendar-almanac-actions">
      <div><b>宜</b><p>{almanac.yi.join(" · ") || "无"}</p></div>
      <div><b>忌</b><p>{almanac.ji.join(" · ") || "无"}</p></div>
    </div>

    <dl className="calendar-almanac-meta">
      <div><dt>值日</dt><dd>{almanac.dayOfficer}</dd></div>
      <div><dt>星宿</dt><dd>{almanac.mansion} · {almanac.mansionLuck}</dd></div>
      <div><dt>冲煞</dt><dd>{almanac.clash} · {almanac.sha}</dd></div>
      <div><dt>吉位</dt><dd>喜神{almanac.joyDirection} · 福神{almanac.fortuneDirection} · 财神{almanac.wealthDirection}</dd></div>
      <div><dt>彭祖</dt><dd>{almanac.pengZu.join("；")}</dd></div>
    </dl>

    <p className="calendar-almanac-note">传统民俗信息，仅供参考</p>
  </section>;
}
