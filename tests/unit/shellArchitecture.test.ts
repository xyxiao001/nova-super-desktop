import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (path: string) =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("desktop shell boundaries", () => {
  it("keeps both entrypoints on the shared DesktopRoot implementation", async () => {
    const [page, main, desktopRoot] = await Promise.all([
      readWorkspaceFile("app/page.tsx"),
      readWorkspaceFile("src/main.tsx"),
      readWorkspaceFile("src/shell/DesktopRoot.tsx"),
    ]);

    expect(page).toContain('import DesktopRoot from "../src/shell/DesktopRoot"');
    expect(page).toContain("<DesktopRoot />");
    expect(page).not.toContain("useState");
    expect(page).not.toContain("windowReducer");
    expect(main).toContain('import Home from "../app/page"');
    expect(desktopRoot).toContain("WindowRuntimeProvider");
  });

  it("keeps extracted presentation components outside workspace ownership", async () => {
    const [windowFrame, icons, taskbar, systemPanel, overlays] = await Promise.all([
      readWorkspaceFile("src/shell/WindowFrame.tsx"),
      readWorkspaceFile("src/shell/DesktopIcons.tsx"),
      readWorkspaceFile("src/shell/DesktopTaskbar.tsx"),
      readWorkspaceFile("src/shell/DesktopSystemPanel.tsx"),
      readWorkspaceFile("src/shell/DesktopOverlays.tsx"),
    ]);

    expect(windowFrame).toContain("nova-window-geometry:");
    expect(windowFrame).toContain("WINDOW_MENU_HOLD_MS = 450");
    expect(windowFrame).toContain("document.documentElement.requestFullscreen()");
    expect(windowFrame).toContain("窗口居中");
    expect(windowFrame).toContain("窗口全屏");
    expect(windowFrame).toContain("系统全屏");
    expect(windowFrame).not.toContain("onPointerEnter");
    expect(windowFrame).not.toContain("desktopStorage");
    expect(windowFrame).not.toContain("Lazy");
    expect(icons).not.toContain("localStorage");
    expect(icons).not.toContain("setItems");
    for (const source of [taskbar, systemPanel, overlays]) {
      expect(source).not.toContain("useState");
      expect(source).not.toContain("useReducer");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("indexedDB");
    }
  });

  it("hosts runtime applications through the manifest-driven AppHost", async () => {
    const [desktopRoot, appHost, appRegistry, tower, youTd2, calculator, focus] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopRoot.tsx"),
      readWorkspaceFile("src/platform/apps/AppHost.tsx"),
      readWorkspaceFile("src/platform/apps/appRegistry.ts"),
      readWorkspaceFile("src/apps/tower/entry.tsx"),
      readWorkspaceFile("src/apps/youtd2/entry.tsx"),
      readWorkspaceFile("src/apps/calculator/entry.tsx"),
      readWorkspaceFile("src/apps/focus/entry.tsx"),
    ]);

    expect(desktopRoot).toContain("allWindowInstances(windowInstances).map");
    for (const app of [
      "photo",
      "explorer",
      "notes",
      "viewer",
      "reader",
      "calendar",
      "games",
      "settings",
      "folder",
      "recycle",
      "mines",
      "chess",
      "gomoku",
      "tower",
      "youtd2",
      "calculator",
      "drawing",
      "focus",
    ]) {
      expect(desktopRoot).not.toContain(`<WindowFrame {...windowProps("${app}")}`);
    }
    expect(appHost).toContain("APP_COMPONENTS[app]");
    expect(appHost).toContain("WindowInstanceProvider");
    expect(appHost).toContain("<AppComponent />");
    expect(appRegistry).not.toContain("LazyCalendarApp");
    expect(appRegistry).not.toContain("LazyFocusClockApp");
    expect(tower).toContain('isAppActive("tower")');
    expect(youTd2).toContain('isAppActive("youtd2")');
    expect(calculator).toContain('isAppActive("calculator")');
    expect(focus).toContain('isAppActive("focus")');
  });

  it("keeps workspace state in DesktopRoot and file applications on runtimes", async () => {
    const [desktopRoot, workspaceRuntime, launchRuntime, settingsRuntime, appRegistry, ...applications] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopRoot.tsx"),
      readWorkspaceFile("src/platform/workspace/WorkspaceRuntime.tsx"),
      readWorkspaceFile("src/platform/launch/LaunchRuntime.tsx"),
      readWorkspaceFile("src/platform/settings/SettingsRuntime.tsx"),
      readWorkspaceFile("src/platform/apps/appRegistry.ts"),
      ...[
        "explorer",
        "notes",
        "viewer",
        "photo",
        "drawing",
        "reader",
        "folder",
        "recycle",
      ].map((name) => readWorkspaceFile(`src/apps/${name}/entry.tsx`)),
    ]);

    expect(desktopRoot).toContain("<WorkspaceRuntimeProvider");
    expect(desktopRoot).toContain("<LaunchRuntimeProvider");
    expect(desktopRoot).toContain("<SettingsRuntimeProvider");
    expect(desktopRoot).not.toContain("activeFolderId");
    expect(desktopRoot).not.toContain("activeNoteId");
    expect(desktopRoot).not.toContain("activeImageId");
    expect(workspaceRuntime).not.toContain("useState");
    expect(workspaceRuntime).not.toContain("activeFolderId");
    expect(workspaceRuntime).not.toContain("activeNote");
    expect(workspaceRuntime).not.toContain("activeImage");
    expect(workspaceRuntime).not.toContain("localStorage");
    expect(workspaceRuntime).not.toContain("indexedDB");
    expect(launchRuntime).not.toContain("useState");
    expect(launchRuntime).not.toContain("localStorage");
    expect(applications.every((source) => source.includes("useWorkspaceRuntime"))).toBe(true);
    expect(applications[0]).toContain("useWindowInstance");
    expect(applications[0]).toContain("retargetInstance");
    expect(applications[1]).toContain("useWindowInstance");
    expect(applications[2]).toContain("isInstanceActive");
    expect(applications[6]).toContain("useWindowInstance");
    expect(settingsRuntime).not.toContain("useState");
    expect(appRegistry).not.toMatch(/export const Lazy[A-Z]/);
  });
});
