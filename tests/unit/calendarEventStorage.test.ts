import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";

import type { CalendarEvent } from "../../src/apps/calendar/calendarEventCore";
import {
  deleteCalendarEvent,
  getAllCalendarEvents,
  putCalendarEvent,
  replaceCalendarEvents,
} from "../../src/apps/calendar/calendarEventStorage";

const DATABASE_NAME = "nova-calendar";

const event = (id: string, title = id): CalendarEvent => ({
  id,
  title,
  date: "2026-09-01",
  allDay: true,
  startTime: "",
  endTime: "",
  color: "teal",
  notes: "",
  createdAt: 1,
  updatedAt: 1,
});

afterEach(async () => {
  await deleteDB(DATABASE_NAME);
});

describe("calendar event storage", () => {
  it("creates, updates, and deletes events", async () => {
    await putCalendarEvent(event("first"));
    await putCalendarEvent(event("first", "已更新"));

    await expect(getAllCalendarEvents()).resolves.toEqual([event("first", "已更新")]);

    await deleteCalendarEvent("first");
    await expect(getAllCalendarEvents()).resolves.toEqual([]);
  });

  it("replaces all events during backup restore", async () => {
    await putCalendarEvent(event("old"));
    await replaceCalendarEvents([event("new"), event("second")]);

    await expect(getAllCalendarEvents()).resolves.toEqual([
      event("new"),
      event("second"),
    ]);
  });
});
