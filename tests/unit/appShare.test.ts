import { describe, expect, it } from "vitest";
import { APP_REGISTRY, type WindowAppId } from "../../src/platform/apps/appRegistry";
import { appShareUrl } from "../../src/platform/apps/appShare";
import { sharedAppWindowState, standaloneAppRoute } from "../../app/standaloneAppRoute";

describe("application sharing", () => {
  it.each(Object.keys(APP_REGISTRY) as WindowAppId[])("opens %s directly from its share URL", app => {
    const link = new URL(appShareUrl(app, "http://100.82.233.127:3000"));
    expect(link.origin).toBe("http://100.82.233.127:3000");
    expect([...link.searchParams.entries()]).toEqual([["app", app]]);
    expect(standaloneAppRoute(link.search)).toBe(app);
    const state = sharedAppWindowState(standaloneAppRoute(link.search));
    expect(Object.values(state.instances)).toEqual([{ id: `${app}:main`, app, target: undefined, minimized: false, maximized: true, z: 2 }]);
    expect(state.focused).toBe(`${app}:main`);
  });
  it("keeps ordinary desktop visits empty and respects existing game routes", () => {
    for (const query of ["", "?game=frontline", "?app=unknown", "?app=toString"]) {
      expect(standaloneAppRoute(query)).toBeNull();
      expect(sharedAppWindowState(standaloneAppRoute(query)).instances).toEqual({});
    }
  });
  it("shares only the app entrance without unrelated parameters or local resource IDs", () => {
    expect(appShareUrl("notes", "https://nova.example/?app=explorer&file=private#draft")).toBe("https://nova.example/?app=notes");
  });
});
