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
    const [reader, flipBook, notes, games, calendar, almanac] = await Promise.all([
      readWorkspaceFile("app/ReaderApp.tsx"),
      readWorkspaceFile("app/ReaderFlipBook.tsx"),
      readWorkspaceFile("app/NotepadApp.tsx"),
      readWorkspaceFile("app/GameHall.tsx"),
      readWorkspaceFile("app/CalendarApp.tsx"),
      readWorkspaceFile("app/calendarAlmanac.ts"),
    ]);

    expect(reader).toContain('import "./reader.css"');
    expect(reader).toContain('className="reader-mobile-toolbar"');
    expect(reader).toContain("setImmersive(compact)");
    expect(reader).toContain("toggleMobileChrome()");
    expect(reader).toContain("DESKTOP_ICON_LONG_PRESS_MS");
    expect(reader).toContain("<ReaderFlipBook");
    expect(reader).toContain('key={`${chapter?.id ?? "chapter"}:${pageCount}`}');
    expect(reader).not.toContain('key={`${chapter?.id ?? "chapter"}:${pageCount}:${safePageIndex}`}');
    expect(reader).toContain("nextChapter={nextFlipChapter}");
    expect(reader).toContain('className="reader-device-status"');
    expect(flipBook).toContain('from "react-pageflip-enhanced"');
    expect(flipBook).toContain("Math.min(3, props.pageCount)");
    expect(flipBook).toContain('key={`${windowStart}:${hasNextChapterPreview}`}');
    expect(flipBook).toContain("const flipPages = useMemo(");
    expect(flipBook).toContain("singlePage={false}");
    expect(flipBook).toContain("<FlipPage key={index}");
    expect(flipBook).toContain('engineRef.current?.flipNext("bottom")');
    expect(flipBook).toContain('engineRef.current?.flipPrev("bottom")');
    expect(flipBook).toContain('event.data !== "read"');
    expect(flipBook).toContain('target.type === "nextChapter"');
    expect(flipBook).toContain("translate3d(${-targetPage * (flowPageWidth + pageGap)}px");
    expect(notes).toContain('import "./productivity-apps.css"');
    expect(games).toContain('import "./games-tools.css"');
    expect(calendar).toContain('import "./calendar.css"');
    expect(calendar).toContain('lazy(() => import("./CalendarAlmanacPanel"))');
    expect(calendar).toContain('type="checkbox"');
    expect(almanac).toContain('from "lunar-typescript"');
  });

  it("keeps the mobile desktop and reader inside the dynamic viewport", async () => {
    const [globals, desktop, reader, productivity, games, page, layout, index, manifestSource] = await Promise.all([
      readWorkspaceFile("app/globals.css"),
      readWorkspaceFile("app/desktop.css"),
      readWorkspaceFile("app/reader.css"),
      readWorkspaceFile("app/productivity-apps.css"),
      readWorkspaceFile("app/games-tools.css"),
      readWorkspaceFile("app/page.tsx"),
      readWorkspaceFile("app/layout.tsx"),
      readWorkspaceFile("index.html"),
      readWorkspaceFile("public/manifest.webmanifest"),
    ]);
    const manifest = JSON.parse(manifestSource) as { display: string; display_override: string[] };

    expect(globals).toContain("height:100dvh");
    expect(globals).toContain(".super-desktop{position:fixed;inset:0;width:auto;height:auto}");
    expect(globals).toContain('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea,select{font-size:16px!important}');
    expect(globals).toContain("background:#0b4d7c");
    expect(desktop).toContain("env(safe-area-inset-bottom)");
    expect(desktop).toContain(".desktop-window.maximized { position:fixed; inset:0!important; width:100vw!important; height:auto!important");
    expect(desktop).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(desktop).toContain(".shortcut-icon { width:62px; height:62px; min-height:62px; flex:none");
    expect(desktop).toContain("font-size:14px; line-height:18px");
    expect(desktop).toContain(".desktop-item.positioned, .desktop-shortcut.positioned { position:static!important");
    expect(desktop).toContain(".desktop-menu { position:fixed");
    expect(desktop).toContain(".windows-desktop.wallpaper-harbor");
    expect(desktop).toContain(".windows-desktop.wallpaper-graphite");
    expect(desktop).toContain(".windows-taskbar,.taskbar-reveal-zone { display:none!important; }");
    expect(desktop).toContain("@keyframes mobileSearchDrop");
    expect(productivity).toContain(".photo-stage { position:relative; min-width:0; min-height:0; overflow:hidden; background:#0c0e0f; touch-action:none; }");
    expect(page).toContain('mobileWindowOpen?"mobile-window-open":""');
    expect(page).toContain("wallpaper-${settings.wallpaper}");
    expect(page).toContain('startMode==="search"?"关闭搜索":"关闭开始菜单"');
    expect(reader).toContain(".reader-sidebar-scrim");
    expect(reader).toContain(".reader-stage{padding:0;background:var(--reader-page)");
    expect(reader).toContain(".reader-page { width:100%; height:100%");
    expect(reader).toContain(".reader-page > .reader-content,.reader-page > .reader-page-viewport");
    expect(reader).toContain(".reader-page{padding-bottom:26px;font-size:calc(var(--reader-font-size) + 2px)}");
    expect(reader).toContain(".reader-book-info>strong{font-size:19px");
    expect(reader).toContain(".reader-shelf{grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(reader).toContain(".reader-reading.immersive.chrome-hidden>.reader-mobile-toolbar");
    expect(reader).toContain(".reader-library.editing .reader-book-delete{display:block}");
    expect(reader).toContain(".reader-manage-button{display:none}");
    expect(reader).toContain(".reader-flip-book-shell");
    expect(reader).toContain(".reader-turn-zone:hover,.reader-turn-zone:active{background:transparent;opacity:0}");
    expect(reader).not.toContain("@keyframes readerPageForward");
    expect(reader).not.toContain(".reader-window{inset:3px 2px 51px");
    expect(productivity).toContain(".notepad-app.mobile-editor-open .note-workspace");
    expect(productivity).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(games).toContain(".focus-dial { width:min(64vw,260px,42dvh)");
    expect(games).toContain(".wallpaper-options");
    expect(games).toContain(".storage-group-toggle");
    expect(games).toContain(".settings-reset-panel");
    expect(layout).toContain('statusBarStyle: "black-translucent"');
    expect(layout).toContain('"mobile-web-app-capable": "yes"');
    expect(index).toContain("maximum-scale=1, user-scalable=no, viewport-fit=cover");
    expect(index).toContain('<meta name="theme-color" content="#0b4d7c"');
    expect(index).toContain('<meta name="mobile-web-app-capable" content="yes"');
    expect(manifest.display).toBe("fullscreen");
    expect(manifest.display_override).toEqual(["fullscreen", "standalone"]);
  });
});
