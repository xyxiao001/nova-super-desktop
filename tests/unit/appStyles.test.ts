import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("application style loading", () => {
  it("keeps application styles out of the desktop entrypoints", async () => {
    const [layout, main] = await Promise.all([
      readWorkspaceFile("app/layout.tsx"),
      readWorkspaceFile("src/main.tsx"),
    ]);

    expect(layout).not.toContain('import "./reader.css"');
    expect(main).not.toContain('import "../app/reader.css"');
    expect(layout).not.toContain("productivity-apps.css");
    expect(layout).not.toContain("games-tools.css");
  });

  it("loads each style group from its lazy application modules", async () => {
    const [reader, notes, games] = await Promise.all([
      readWorkspaceFile("app/ReaderApp.tsx"),
      readWorkspaceFile("app/NotepadApp.tsx"),
      readWorkspaceFile("app/GameHall.tsx"),
    ]);

    expect(reader).toContain('import "./reader.css"');
    expect(notes).toContain('import "./productivity-apps.css"');
    expect(games).toContain('import "./games-tools.css"');
  });

  it("keeps the mobile desktop and reader inside the dynamic viewport", async () => {
    const [globals, desktop, reader, productivity, games, page] = await Promise.all([
      readWorkspaceFile("app/globals.css"),
      readWorkspaceFile("app/desktop.css"),
      readWorkspaceFile("app/reader.css"),
      readWorkspaceFile("app/productivity-apps.css"),
      readWorkspaceFile("app/games-tools.css"),
      readWorkspaceFile("app/page.tsx"),
    ]);

    expect(globals).toContain("height:100dvh");
    expect(desktop).toContain("env(safe-area-inset-bottom)");
    expect(desktop).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(desktop).toContain(".desktop-item.positioned, .desktop-shortcut.positioned { position:static!important");
    expect(desktop).toContain(".desktop-menu { position:fixed");
    expect(desktop).toContain(".windows-taskbar,.taskbar-reveal-zone { display:none!important; }");
    expect(desktop).toContain("@keyframes mobileSearchDrop");
    expect(page).toContain('mobileWindowOpen?"mobile-window-open":""');
    expect(page).toContain('startMode==="search"?"关闭搜索":"关闭开始菜单"');
    expect(reader).toContain(".reader-sidebar-scrim");
    expect(reader).toContain(".reader-stage{padding:0;background:var(--reader-page)");
    expect(productivity).toContain(".notepad-app.mobile-editor-open .note-workspace");
    expect(productivity).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(games).toContain(".focus-dial { width:min(64vw,260px,42dvh)");
  });
});
