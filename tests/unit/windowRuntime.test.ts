import { describe, expect, it } from "vitest";
import { windowIsActive } from "../../src/platform/windows/WindowRuntime";
import {
  createInitialWindowInstanceManagerState,
  windowInstanceReducer,
} from "../../src/platform/windows/windowInstanceState";

describe("window runtime", () => {
  it("treats only the focused visible window as active", () => {
    let state = createInitialWindowInstanceManagerState();
    state = windowInstanceReducer(state, {
      type: "open",
      id: "gomoku:main",
      app: "gomoku",
    });

    expect(windowIsActive(state.instances, state.focused, "gomoku")).toBe(true);
    expect(windowIsActive(state.instances, state.focused, "reader")).toBe(false);

    state = windowInstanceReducer(state, { type: "minimize", id: "gomoku:main" });
    expect(windowIsActive(state.instances, state.focused, "gomoku")).toBe(false);
  });
});
