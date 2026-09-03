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

  it("loads each application stylesheet from its lazy entry module", async () => {
    const [reader, flipBook, notes, games, calendar, almanac] = await Promise.all([
      readWorkspaceFile("src/apps/reader/entry.tsx"),
      readWorkspaceFile("src/apps/reader/ReaderFlipBook.tsx"),
      readWorkspaceFile("src/apps/notes/entry.tsx"),
      readWorkspaceFile("src/apps/games/entry.tsx"),
      readWorkspaceFile("src/apps/calendar/entry.tsx"),
      readWorkspaceFile("src/apps/calendar/calendarAlmanac.ts"),
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
    expect(flipBook).toContain('target?.type === "nextChapter") props.onBoundaryNext()');
    expect(flipBook).toContain("translate3d(${-targetPage * (flowPageWidth + pageGap)}px");
    expect(notes).toContain('import "./notes.css"');
    expect(games).toContain('import "./games.css"');
    expect(calendar).toContain('import "./calendar.css"');
    expect(calendar).toContain('lazy(() => import("./CalendarAlmanacPanel"))');
    expect(calendar).toContain('type="checkbox"');
    expect(almanac).toContain('from "lunar-typescript"');
  });

  it("keeps the mobile desktop and reader inside the dynamic viewport", async () => {
    const [globals, desktop, reader, notes, viewer, explorer, focus, settings, desktopRoot, windowFrame, page, layout, index, manifestSource] = await Promise.all([
      readWorkspaceFile("app/globals.css"),
      readWorkspaceFile("app/desktop.css"),
      readWorkspaceFile("src/apps/reader/reader.css"),
      readWorkspaceFile("src/apps/notes/notes.css"),
      readWorkspaceFile("src/apps/viewer/viewer.css"),
      readWorkspaceFile("src/apps/explorer/explorer.css"),
      readWorkspaceFile("src/apps/focus/focus.css"),
      readWorkspaceFile("src/apps/settings/settings.css"),
      readWorkspaceFile("src/shell/DesktopRoot.tsx"),
      readWorkspaceFile("src/shell/WindowFrame.tsx"),
      readWorkspaceFile("app/page.tsx"),
      readWorkspaceFile("app/layout.tsx"),
      readWorkspaceFile("index.html"),
      readWorkspaceFile("public/manifest.webmanifest"),
    ]);
    const manifest = JSON.parse(manifestSource) as { display: string; display_override: string[] };

    expect(globals).toContain("height:100dvh");
    expect(globals).toContain(".super-desktop{position:relative;width:100%;height:100vh}");
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
    expect(desktop).toContain(".windows-desktop.wallpaper-starport");
    expect(desktop).toContain(".windows-desktop.wallpaper-rain");
    expect(desktop).toContain(".windows-desktop.wallpaper-abyss");
    expect(desktop).toContain("@keyframes wallpaperMeteor");
    expect(desktop).toContain("@keyframes wallpaperRain");
    expect(desktop).toContain("@keyframes wallpaperCreature");
    expect(desktop).toContain(".windows-taskbar,.taskbar-reveal-zone { display:none!important; }");
    expect(desktop).toContain("@keyframes mobileSearchDrop");
    expect(viewer).toContain(".photo-stage { position:relative; min-width:0; min-height:0; overflow:hidden; background:#0c0e0f; touch-action:none; }");
    expect(desktopRoot).toContain('mobileWindowOpen?"mobile-window-open":""');
    expect(desktopRoot).toContain("wallpaper-${settings.wallpaper}");
    expect(desktopRoot).toContain('startMode==="search"?"关闭搜索":"关闭开始菜单"');
    expect(page).toContain('import DesktopRoot from "../src/shell/DesktopRoot"');
    expect(page).not.toContain("useState");
    expect(reader).toContain(".reader-sidebar-scrim");
    expect(reader).toContain(".reader-stage{padding:0;background:var(--reader-page)");
    expect(reader).toContain(".reader-page { width:100%; height:100%");
    expect(reader).toContain(".reader-page > .reader-content,.reader-page > .reader-page-viewport");
    expect(reader).toContain(".reader-page{padding-bottom:26px;font-size:calc(var(--reader-font-size) + 2px)}");
    expect(reader).toContain(".reader-book-info>strong{font-size:19px");
    expect(reader).toContain(".reader-shelf{grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(reader).toContain(".reader-reading.immersive.chrome-hidden>.reader-mobile-toolbar");
    expect(reader).toContain(".reader-window:has(.reader-reading) .window-chrome{display:none}");
    expect(windowFrame).toContain("desktop-window ${app}-window");
    expect(reader).toContain(".reader-library.editing .reader-book-delete{display:block}");
    expect(reader).toContain(".reader-manage-button{display:none}");
    expect(reader).toContain(".reader-flip-book-shell");
    expect(reader).toContain(".reader-turn-zone:hover,.reader-turn-zone:active{background:transparent;opacity:0}");
    expect(reader).not.toContain("@keyframes readerPageForward");
    expect(reader).not.toContain(".reader-window{inset:3px 2px 51px");
    expect(reader).not.toMatch(/\.reader-window\s*\{\s*(?:inset|width|height|left|top):/);
    expect(desktop).toContain(".window-size-standard");
    expect(desktop).not.toMatch(/\.(?:photo|notes|viewer|explorer|folder|recycle|games|settings|mines|chess|gomoku|tower|calculator|drawing|focus|calendar)-window\s*\{/);
    expect(notes).toContain(".notepad-app.mobile-editor-open .note-workspace");
    expect(explorer).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(focus).toContain(".focus-dial { width:min(64vw,260px,42dvh)");
    expect(settings).toContain(".wallpaper-options");
    expect(settings).toContain(".storage-group-toggle");
    expect(settings).toContain(".settings-reset-panel");
    expect(layout).toContain('statusBarStyle: "black-translucent"');
    expect(layout).toContain('"mobile-web-app-capable": "yes"');
    expect(index).toContain("maximum-scale=1, user-scalable=no, viewport-fit=cover");
    expect(index).toContain('<meta name="theme-color" content="#0b4d7c"');
    expect(index).toContain('<meta name="mobile-web-app-capable" content="yes"');
    expect(manifest.display).toBe("fullscreen");
    expect(manifest.display_override).toEqual(["fullscreen", "standalone"]);
  });
});
