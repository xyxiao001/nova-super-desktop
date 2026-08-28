import { describe, expect, it } from "vitest";
import { appIsActive } from "../../app/AppRuntime";
import { createInitialWindowManagerState, windowReducer } from "../../app/windowState";

describe("app runtime", () => {
  it("treats only the focused visible window as active", () => {
    let state = createInitialWindowManagerState();
    state = windowReducer(state, { type: "open", app: "sudoku" });

    expect(appIsActive(state.windows, state.focused, "sudoku")).toBe(true);
    expect(appIsActive(state.windows, state.focused, "reader")).toBe(false);

    state = windowReducer(state, { type: "minimize", app: "sudoku" });
    expect(appIsActive(state.windows, state.focused, "sudoku")).toBe(false);
  });
});
