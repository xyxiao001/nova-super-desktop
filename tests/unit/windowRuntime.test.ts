import { describe, expect, it } from "vitest";
import { windowIsActive } from "../../src/platform/windows/WindowRuntime";
import { createInitialWindowManagerState, windowReducer } from "../../src/platform/windows/windowState";

describe("window runtime", () => {
  it("treats only the focused visible window as active", () => {
    let state = createInitialWindowManagerState();
    state = windowReducer(state, { type: "open", app: "gomoku" });

    expect(windowIsActive(state.windows, state.focused, "gomoku")).toBe(true);
    expect(windowIsActive(state.windows, state.focused, "reader")).toBe(false);

    state = windowReducer(state, { type: "minimize", app: "gomoku" });
    expect(windowIsActive(state.windows, state.focused, "gomoku")).toBe(false);
  });
});
