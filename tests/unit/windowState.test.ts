import { describe, expect, it } from "vitest";
import { REGISTERED_APPS } from "../../app/appRegistry";
import {
  createInitialWindowManagerState,
  windowReducer,
} from "../../app/windowState";

describe("window state reducer", () => {
  it("starts with every application closed and the desktop focused", () => {
    const state = createInitialWindowManagerState();

    expect(state.focused).toBe("desktop");
    expect(state.nextZ).toBe(1);
    expect(REGISTERED_APPS.every((app) => !state.windows[app.id].open)).toBe(true);
  });

  it("opens and focuses windows with increasing z-index values", () => {
    const opened = windowReducer(createInitialWindowManagerState(), { type: "open", app: "notes" });
    const focused = windowReducer(opened, { type: "focus", app: "reader" });

    expect(opened.windows.notes).toMatchObject({ open: true, minimized: false, z: 2 });
    expect(opened.focused).toBe("notes");
    expect(focused.windows.reader.z).toBe(3);
    expect(focused.focused).toBe("reader");
  });

  it("focuses the top visible window after close or minimize", () => {
    let state = createInitialWindowManagerState();
    state = windowReducer(state, { type: "open", app: "notes" });
    state = windowReducer(state, { type: "open", app: "reader" });
    state = windowReducer(state, { type: "focus", app: "notes" });

    const closed = windowReducer(state, { type: "close", app: "notes" });
    const minimized = windowReducer(state, { type: "minimize", app: "notes" });

    expect(closed.windows.notes.open).toBe(false);
    expect(closed.focused).toBe("reader");
    expect(minimized.windows.notes.minimized).toBe(true);
    expect(minimized.focused).toBe("reader");
  });

  it("returns focus to the desktop when no other window is visible", () => {
    const opened = windowReducer(createInitialWindowManagerState(), { type: "open", app: "notes" });

    expect(windowReducer(opened, { type: "close", app: "notes" }).focused).toBe("desktop");
    expect(windowReducer(opened, { type: "minimize", app: "notes" }).focused).toBe("desktop");
  });

  it("dismisses a window without changing focus", () => {
    const opened = windowReducer(createInitialWindowManagerState(), { type: "open", app: "viewer" });
    const dismissed = windowReducer(opened, { type: "dismiss", app: "viewer" });

    expect(dismissed.windows.viewer.open).toBe(false);
    expect(dismissed.focused).toBe("viewer");
  });

  it("keeps maximize and snap state mutually exclusive", () => {
    const opened = windowReducer(createInitialWindowManagerState(), { type: "open", app: "games" });
    const snapped = windowReducer(opened, { type: "snap", app: "games", mode: "left" });
    const maximized = windowReducer(snapped, { type: "toggle-maximize", app: "games" });
    const unsnapped = windowReducer(maximized, { type: "update", app: "games", patch: { snapMode: undefined } });

    expect(snapped.windows.games).toMatchObject({ maximized: false, minimized: false, snapMode: "left" });
    expect(snapped.focused).toBe("games");
    expect(maximized.windows.games.maximized).toBe(true);
    expect(maximized.windows.games.snapMode).toBeUndefined();
    expect(unsnapped.windows.games.snapMode).toBeUndefined();
  });

  it("can explicitly return focus to the desktop", () => {
    const opened = windowReducer(createInitialWindowManagerState(), { type: "open", app: "settings" });
    const desktop = windowReducer(opened, { type: "focus-desktop" });

    expect(desktop.focused).toBe("desktop");
  });
});
