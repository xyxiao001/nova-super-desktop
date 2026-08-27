export type DesktopNotification = {
  id: number;
  message: string;
  createdAt: number;
  itemId?: string;
};

export type CalendarDay = {
  key: string;
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
): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);

    return {
      key: `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`,
      date: value.getDate(),
      currentMonth: value.getMonth() === month,
      today:
        value.getFullYear() === today.getFullYear()
        && value.getMonth() === today.getMonth()
        && value.getDate() === today.getDate(),
    };
  });
}
