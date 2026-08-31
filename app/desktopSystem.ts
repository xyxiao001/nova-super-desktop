export type DesktopNotification = {
  id: number;
  message: string;
  createdAt: number;
  itemId?: string;
};

export type CalendarDay = {
  key: string;
  isoDate: string;
  year: number;
  month: number;
  date: number;
  currentMonth: boolean;
  today: boolean;
};

export function appendDesktopNotification(
  current: DesktopNotification[],
  notification: DesktopNotification,
  limit = 8,
) {
  return [notification, ...current].slice(0, limit);
}

export function calendarDays(
  year: number,
  month: number,
  today = new Date(),
  weekStartsOn: 0 | 1 = 0,
): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const leadingDays = (firstDay.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(year, month, 1 - leadingDays);

  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    const valueYear = value.getFullYear();
    const valueMonth = value.getMonth();
    const valueDate = value.getDate();
    const isoDate = [
      valueYear,
      String(valueMonth + 1).padStart(2, "0"),
      String(valueDate).padStart(2, "0"),
    ].join("-");

    return {
      key: isoDate,
      isoDate,
      year: valueYear,
      month: valueMonth,
      date: valueDate,
      currentMonth: valueMonth === month,
      today:
        valueYear === today.getFullYear()
        && valueMonth === today.getMonth()
        && valueDate === today.getDate(),
    };
  });
}
