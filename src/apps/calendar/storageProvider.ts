import { type StorageProvider, encodedSize } from "../../platform/storage/providers/types";
import { isCalendarEvent, type CalendarEvent } from "./calendarEventCore";
import {
  getAllCalendarEvents,
  replaceCalendarEvents,
} from "./calendarEventStorage";

const calendarProvider: StorageProvider = {
  id: "calendar",
  label: "日历日程",
  displayOrder: 2,
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 项个人日程`,
  inspect: async () => {
    const events = await getAllCalendarEvents();
    return { entries: events.length, bytes: events.length ? encodedSize(events) : 0 };
  },
  exportData: () => getAllCalendarEvents(),
  validateData: (data) => Array.isArray(data) && data.every(isCalendarEvent),
  restoreData: async (data) => {
    if (!Array.isArray(data) || !data.every(isCalendarEvent)) {
      throw new Error("Invalid calendar backup data");
    }
    await replaceCalendarEvents(data as CalendarEvent[]);
  },
  clear: () => replaceCalendarEvents([]),
};

export default calendarProvider;
