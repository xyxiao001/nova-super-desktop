import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  NOVA_SYSTEM_MOMENT_EVENT,
  clearSystemMoment,
  createNovaSystemMoment,
  publishNovaSystemMoment,
  replaceSystemMoment,
  subscribeNovaSystemMoments,
  systemMomentDuration,
} from "../../app/systemMoments";

const readWorkspaceFile = (path: string) =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("system moments", () => {
  it("creates an event containing only effect selection metadata", () => {
    expect(createNovaSystemMoment("creative-save", "drawing", "moment-1")).toEqual({
      id: "moment-1",
      type: "creative-save",
      source: "drawing",
    });
  });

  it("publishes moments to subscribers and removes the listener", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = subscribeNovaSystemMoments(listener, target);

    publishNovaSystemMoment("game-win", "mines", target, "moment-1");
    unsubscribe();
    publishNovaSystemMoment("game-win", "chess", target, "moment-2");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      id: "moment-1",
      type: "game-win",
      source: "mines",
    });
  });

  it("uses one current moment and does not let an old timer clear its replacement", () => {
    const first = createNovaSystemMoment("creative-save", "photo", "first");
    const second = createNovaSystemMoment("focus-complete", "focus", "second");
    const current = replaceSystemMoment(first, second);

    expect(current).toBe(second);
    expect(clearSystemMoment(current, first.id)).toBe(second);
    expect(clearSystemMoment(current, second.id)).toBeNull();
  });

  it("caps effect durations and shortens reduced-motion feedback", () => {
    expect(systemMomentDuration("creative-save", false)).toBe(1800);
    expect(systemMomentDuration("focus-complete", false)).toBe(2400);
    expect(systemMomentDuration("game-win", false)).toBe(2400);
    expect(systemMomentDuration("game-win", true)).toBe(600);
  });

  it("wires only the approved success branches and applications", async () => {
    const [photo, drawing, focus, mines, chess, gomoku, tower, youTd2, wolfslot] = await Promise.all([
      readWorkspaceFile("src/apps/photo/entry.tsx"),
      readWorkspaceFile("src/apps/drawing/entry.tsx"),
      readWorkspaceFile("src/apps/focus/entry.tsx"),
      readWorkspaceFile("src/apps/mines/entry.tsx"),
      readWorkspaceFile("src/apps/chess/entry.tsx"),
      readWorkspaceFile("src/apps/gomoku/entry.tsx"),
      readWorkspaceFile("src/apps/tower/entry.tsx"),
      readWorkspaceFile("src/apps/youtd2/entry.tsx"),
      readWorkspaceFile("src/apps/wolfslot/entry.tsx"),
    ]);

    expect(photo).toContain('if(saveMode==="copy"){playNovaSound("success");publishNovaSystemMoment("creative-save","photo")}');
    expect(drawing).toContain('publishNovaSystemMoment("creative-save","drawing")');
    expect(focus).toContain('if (view === "focus" && preset === "focus")');
    expect(focus).toContain('publishNovaSystemMoment("focus-complete", "focus")');
    expect(mines).toContain('publishNovaSystemMoment("game-win", "mines")');
    expect(chess).toContain('if(result==="win")publishNovaSystemMoment("game-win","chess")');
    expect(gomoku).toContain('if(result==="win")publishNovaSystemMoment("game-win","gomoku")');
    for (const source of [tower, youTd2, wolfslot]) {
      expect(source).not.toContain("publishNovaSystemMoment");
    }
  });

  it("uses the dedicated browser event name", () => {
    expect(NOVA_SYSTEM_MOMENT_EVENT).toBe("nova-system-moment");
  });
});
