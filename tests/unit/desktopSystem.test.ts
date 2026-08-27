import { describe, expect, it } from "vitest";

import {
  createAppLaunchIntent,
  launchIntentFor,
} from "../../app/appLaunch";
import {
  appendDesktopNotification,
  calendarDays,
} from "../../app/desktopSystem";

describe("app launch intents", () => {
  it("keeps the target and request identity together", () => {
    const intent = createAppLaunchIntent(4, {
      app: "explorer",
      kind: "file",
      itemId: "note",
      parentId: "folder",
    });

    expect(launchIntentFor(intent, "explorer")).toEqual({
      requestId: 4,
      app: "explorer",
      kind: "file",
      itemId: "note",
      parentId: "folder",
    });
    expect(launchIntentFor(intent, "reader")).toBeNull();
  });
});

describe("desktop notifications", () => {
  it("prepends notifications and enforces the history limit", () => {
    const current = [
      { id: 2, message: "second", createdAt: 2 },
      { id: 1, message: "first", createdAt: 1 },
    ];

    expect(appendDesktopNotification(
      current,
      { id: 3, message: "third", createdAt: 3 },
      2,
    )).toEqual([
      { id: 3, message: "third", createdAt: 3 },
      { id: 2, message: "second", createdAt: 2 },
    ]);
  });
});

describe("calendar days", () => {
  it("creates a stable six-week grid with adjacent month days", () => {
    const days = calendarDays(2026, 7, new Date(2026, 7, 28));

    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ date: 26, currentMonth: false });
    expect(days.find((day) => day.today)).toMatchObject({
      date: 28,
      currentMonth: true,
    });
  });
});
