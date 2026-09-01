import { Solar } from "lunar-typescript";

export type CalendarAlmanac = {
  lunarDate: string;
  ganZhi: string;
  zodiac: string;
  festivals: string[];
  solarTerm: string;
  yi: string[];
  ji: string[];
  dayOfficer: string;
  daySpirit: string;
  dayLuck: string;
  mansion: string;
  mansionLuck: string;
  clash: string;
  sha: string;
  joyDirection: string;
  fortuneDirection: string;
  wealthDirection: string;
  pengZu: string[];
};

export function createCalendarAlmanac(year: number, month: number, day: number): CalendarAlmanac {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const festivals = new Set([
    ...solar.getFestivals(),
    ...solar.getOtherFestivals(),
    ...lunar.getFestivals(),
    ...lunar.getOtherFestivals(),
  ]);

  return {
    lunarDate: lunar.toString(),
    ganZhi: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    zodiac: lunar.getYearShengXiao(),
    festivals: [...festivals],
    solarTerm: lunar.getJieQi(),
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    dayOfficer: `${lunar.getZhiXing()}日`,
    daySpirit: lunar.getDayTianShen(),
    dayLuck: lunar.getDayTianShenLuck(),
    mansion: `${lunar.getXiu()}宿`,
    mansionLuck: lunar.getXiuLuck(),
    clash: `冲${lunar.getDayChongDesc()}`,
    sha: `煞${lunar.getDaySha()}`,
    joyDirection: lunar.getDayPositionXiDesc(),
    fortuneDirection: lunar.getDayPositionFuDesc(),
    wealthDirection: lunar.getDayPositionCaiDesc(),
    pengZu: [lunar.getPengZuGan(), lunar.getPengZuZhi()],
  };
}
