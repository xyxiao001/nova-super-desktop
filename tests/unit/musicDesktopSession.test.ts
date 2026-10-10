import { describe, expect, it } from "vitest";
import { createMusicDesktopSession } from "../../src/apps/music/musicDesktopSession";

const windowSurface = {} as HTMLDivElement;
describe("independent desktop music session", () => {
  it("retains the pinned card and theme when its application surface closes and reopens", () => {
    const session = createMusicDesktopSession();
    session.setSurface(windowSurface);
    session.update({ pinned: true, theme: "night" });
    session.setSurface(null);
    expect(session.getSnapshot()).toEqual({ surface: null, pinned: true, theme: "night" });
    session.setSurface(windowSurface);
    expect(session.getSnapshot()).toEqual({ surface: windowSurface, pinned: true, theme: "night" });
  });

  it("can remove the card while keeping the application surface mounted", () => {
    const session = createMusicDesktopSession();
    session.setSurface(windowSurface);
    session.update({ pinned: true });
    session.update({ pinned: false });
    expect(session.getSnapshot()).toEqual({ surface: windowSurface, pinned: false, theme: "warm" });
    session.setSurface(null);
    expect(session.getSnapshot()).toEqual({ surface: null, pinned: false, theme: "warm" });
  });
});
