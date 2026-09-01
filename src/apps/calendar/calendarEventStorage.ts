import { openDB, type DBSchema } from "idb";

import type { CalendarEvent } from "./calendarEventCore";

const DATABASE_NAME = "nova-calendar";
const DATABASE_VERSION = 1;
const EVENT_STORE = "events";

interface CalendarDatabase extends DBSchema {
  events: {
    key: string;
    value: CalendarEvent;
    indexes: { "by-date": string };
  };
}

const openCalendarDatabase = () => openDB<CalendarDatabase>(DATABASE_NAME, DATABASE_VERSION, {
  upgrade(database) {
    const events = database.createObjectStore(EVENT_STORE, { keyPath: "id" });
    events.createIndex("by-date", "date");
  },
});

export async function getAllCalendarEvents() {
  const database = await openCalendarDatabase();
  try {
    return await database.getAll(EVENT_STORE);
  } finally {
    database.close();
  }
}

export async function putCalendarEvent(event: CalendarEvent) {
  const database = await openCalendarDatabase();
  try {
    await database.put(EVENT_STORE, event);
  } finally {
    database.close();
  }
}

export async function deleteCalendarEvent(id: string) {
  const database = await openCalendarDatabase();
  try {
    await database.delete(EVENT_STORE, id);
  } finally {
    database.close();
  }
}

export async function replaceCalendarEvents(events: CalendarEvent[]) {
  const database = await openCalendarDatabase();
  try {
    const transaction = database.transaction(EVENT_STORE, "readwrite");
    await transaction.store.clear();
    await Promise.all(events.map((event) => transaction.store.put(event)));
    await transaction.done;
  } finally {
    database.close();
  }
}
