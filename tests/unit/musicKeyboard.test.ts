import { describe, expect, it } from "vitest";
import { musicKeyAction } from "../../src/apps/music/useMusicShortcuts";
const key = { code: "Space", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false };
describe("music keyboard shortcuts", () => {
  it.each([["Space", "toggle"], ["ArrowLeft", "rewind"], ["ArrowRight", "forward"], ["ArrowUp", "louder"], ["ArrowDown", "quieter"]])("maps %s to %s", (code, action) => {
    expect(musicKeyAction({ ...key, code })).toBe(action);
  });
  it.each(["ctrlKey", "metaKey", "altKey", "shiftKey", "isComposing"] as const)("preserves %s combinations", (modifier) => {
    expect(musicKeyAction({ ...key, [modifier]: true })).toBeUndefined();
  });
  it("does not repeatedly toggle when Space is held", () => {
    expect(musicKeyAction({ ...key, repeat: true })).toBeUndefined();
    expect(musicKeyAction({ ...key, code: "ArrowRight", repeat: true })).toBe("forward");
  });
  it("leaves unrelated keys alone", () => {
    expect(musicKeyAction({ ...key, code: "Enter" })).toBeUndefined();
  });
});
