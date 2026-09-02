import { describe, expect, it } from "vitest";
import {
  createWindowInstanceId,
  createInitialWindowInstanceManagerState,
  findResourceWindowInstance,
  instancesForApp,
  mostRecentInstanceForApp,
  mostRecentUnboundInstanceForApp,
  selectResourceWindowInstance,
  singletonWindowInstanceId,
  topWindowInstance,
  windowInstanceIsActive,
  windowInstanceReducer,
} from "../../src/platform/windows/windowInstanceState";

describe("window instance state", () => {
  it("starts without running windows and focuses the desktop", () => {
    const state = createInitialWindowInstanceManagerState();

    expect(state.instances).toEqual({});
    expect(state.focused).toBe("desktop");
    expect(state.nextZ).toBe(1);
    expect(singletonWindowInstanceId("reader")).toBe("reader:main");
    expect(createWindowInstanceId("explorer", "secondary")).toBe("explorer:secondary");
  });

  it("opens independent instances of the same application", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "explorer:first",
      app: "explorer",
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "explorer:second",
      app: "explorer",
    });

    expect(instancesForApp(state, "explorer").map((instance) => instance.id)).toEqual([
      "explorer:second",
      "explorer:first",
    ]);
    expect(state.instances["explorer:first"]!.z).toBe(2);
    expect(state.instances["explorer:second"]!.z).toBe(3);
    expect(state.focused).toBe("explorer:second");
  });

  it("finds the most recent application instance and an exact resource target", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:alpha",
      app: "notes",
      target: { kind: "text", itemId: "alpha" },
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:beta",
      app: "notes",
      target: { kind: "text", itemId: "beta" },
    });

    expect(mostRecentInstanceForApp(state, "notes")?.id).toBe("notes:beta");
    expect(findResourceWindowInstance(
      state,
      "notes",
      { kind: "text", itemId: "alpha" },
    )?.id).toBe("notes:alpha");
    expect(findResourceWindowInstance(
      state,
      "viewer",
      { kind: "text", itemId: "alpha" },
    )).toBeUndefined();
  });

  it("finds the most recent unbound instance for first resource assignment", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:bound",
      app: "notes",
      target: { kind: "text", itemId: "alpha" },
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:empty",
      app: "notes",
    });

    expect(mostRecentUnboundInstanceForApp(state, "notes")?.id).toBe(
      "notes:empty",
    );
    expect(mostRecentUnboundInstanceForApp(state, "viewer")).toBeUndefined();
    expect(selectResourceWindowInstance(
      state,
      "notes",
      { kind: "text", itemId: "beta" },
      false,
    )?.id).toBe("notes:empty");
    expect(selectResourceWindowInstance(
      state,
      "notes",
      { kind: "text", itemId: "beta" },
      true,
    )?.id).toBe("notes:empty");
  });

  it("prefers the most recent instance when compact resource views must be reused", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "viewer:empty",
      app: "viewer",
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "viewer:current",
      app: "viewer",
      target: { kind: "image", itemId: "alpha" },
    });

    expect(selectResourceWindowInstance(
      state,
      "viewer",
      { kind: "image", itemId: "beta" },
      true,
    )?.id).toBe("viewer:current");
    expect(selectResourceWindowInstance(
      state,
      "viewer",
      { kind: "image", itemId: "beta" },
      false,
    )?.id).toBe("viewer:empty");
  });

  it("restores and focuses only the requested instance", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "viewer:first",
      app: "viewer",
      target: { kind: "image", itemId: "first" },
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "viewer:second",
      app: "viewer",
      target: { kind: "image", itemId: "second" },
    });
    state = windowInstanceReducer(state, { type: "minimize", id: "viewer:first" });
    state = windowInstanceReducer(state, { type: "focus", id: "viewer:first" });

    expect(state.instances["viewer:first"]!.minimized).toBe(false);
    expect(state.instances["viewer:second"]!.minimized).toBe(false);
    expect(windowInstanceIsActive(state, "viewer:first")).toBe(true);
    expect(windowInstanceIsActive(state, "viewer:second")).toBe(false);
  });

  it("reopens an existing instance without losing its resource target", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:alpha",
      app: "notes",
      target: { kind: "text", itemId: "alpha" },
    });
    state = windowInstanceReducer(state, { type: "minimize", id: "notes:alpha" });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:alpha",
      app: "notes",
    });

    expect(Object.keys(state.instances)).toEqual(["notes:alpha"]);
    expect(state.instances["notes:alpha"]).toMatchObject({
      minimized: false,
      target: { kind: "text", itemId: "alpha" },
    });
    expect(state.focused).toBe("notes:alpha");
  });

  it("focuses the next visible instance after closing or minimizing the active one", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "folder:first",
      app: "folder",
      target: { kind: "folder", itemId: "first" },
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "folder:second",
      app: "folder",
      target: { kind: "folder", itemId: "second" },
    });

    const minimized = windowInstanceReducer(state, {
      type: "minimize",
      id: "folder:second",
    });
    const closed = windowInstanceReducer(state, {
      type: "close",
      id: "folder:second",
    });

    expect(minimized.focused).toBe("folder:first");
    expect(closed.focused).toBe("folder:first");
    expect(closed.instances["folder:second"]).toBeUndefined();
  });

  it("dismisses an instance and moves focus to the next visible window", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:first",
      app: "notes",
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "viewer:first",
      app: "viewer",
    });
    state = windowInstanceReducer(state, {
      type: "dismiss",
      id: "viewer:first",
    });

    expect(state.instances["viewer:first"]).toBeUndefined();
    expect(state.focused).toBe("notes:first");
  });

  it("keeps window state changes isolated by instance id", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "explorer:first",
      app: "explorer",
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "explorer:second",
      app: "explorer",
    });
    state = windowInstanceReducer(state, {
      type: "snap",
      id: "explorer:first",
      mode: "left",
    });
    state = windowInstanceReducer(state, {
      type: "toggle-maximize",
      id: "explorer:first",
    });

    expect(state.instances["explorer:first"]).toMatchObject({
      maximized: true,
      minimized: false,
      snapMode: undefined,
    });
    expect(state.instances["explorer:second"]).toMatchObject({
      maximized: false,
      minimized: false,
    });
  });

  it("retargets one instance without changing its application identity", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:current",
      app: "notes",
      target: { kind: "text", itemId: "alpha" },
    });
    state = windowInstanceReducer(state, {
      type: "retarget",
      id: "notes:current",
      target: { kind: "text", itemId: "beta" },
    });

    expect(state.instances["notes:current"]).toMatchObject({
      app: "notes",
      target: { kind: "text", itemId: "beta" },
    });
  });

  it("selects the top visible instance and ignores minimized instances", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "notes:first",
      app: "notes",
    });
    state = windowInstanceReducer(state, {
      type: "open",
      id: "viewer:first",
      app: "viewer",
    });
    state = windowInstanceReducer(state, {
      type: "minimize",
      id: "viewer:first",
    });

    expect(topWindowInstance(state.instances)).toBe("notes:first");
    expect(topWindowInstance(state.instances, "notes:first")).toBe("desktop");
  });

  it("ignores stale actions for an instance that no longer exists", () => {
    const state = createInitialWindowInstanceManagerState();

    expect(windowInstanceReducer(state, {
      type: "focus",
      id: "notes:closed",
    })).toBe(state);
    expect(windowInstanceReducer(state, {
      type: "close",
      id: "notes:closed",
    })).toBe(state);
  });
});
