import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FutureWorkspace, { type FutureWorkspaceProps } from "../../src/shell/FutureWorkspace";
import { LAUNCHER_APPS } from "../../src/platform/apps/appRegistry";
import { pairWorkspaceWindows } from "../../src/shell/futureWindowLayout";
import { windowInstanceReducer, type WindowInstanceManagerState } from "../../src/platform/windows/windowInstanceState";

const props = (): FutureWorkspaceProps => ({
  view: "apps", overview: false, instances: {}, focused: "desktop",
  onViewChange: vi.fn(), onDismiss: vi.fn(), onSearch: vi.fn(),
  onLaunch: vi.fn(), onFocus: vi.fn(), onMinimize: vi.fn(), onClose: vi.fn(), onPair: vi.fn(),
});

describe("future workspace", () => {
  it("makes every registered launcher application available in the application space", () => {
    const html = renderToStaticMarkup(jsx(FutureWorkspace, props()));
    for (const app of LAUNCHER_APPS) expect(html).toContain(app.label);
    expect(html.match(/class="future-app-card"/g)).toHaveLength(LAUNCHER_APPS.length);
  });

  it("shows separate resource windows, including minimized windows, in focus order", () => {
    const html = renderToStaticMarkup(jsx(FutureWorkspace, {
      ...props(), view: "windows", overview: true, focused: "notes:second",
      instances: {
        "notes:first": { id: "notes:first", app: "notes", title: "草稿一", minimized: true, maximized: false, z: 1 },
        "notes:second": { id: "notes:second", app: "notes", title: "草稿二", minimized: false, maximized: false, z: 2 },
      },
    }));
    expect(html.indexOf("草稿二")).toBeLessThan(html.indexOf("草稿一"));
    expect(html).toContain('aria-label="恢复 草稿一"');
    expect(html).toContain('aria-label="最小化 草稿二"');
    expect(html).not.toContain('aria-label="最小化 草稿一"');
    expect(html).toContain('aria-label="关闭 草稿一"');
    expect(html).toContain('aria-label="关闭 草稿二"');
  });

  it("leaves the file view to the existing desktop surface", () => {
    const html = renderToStaticMarkup(jsx(FutureWorkspace, { ...props(), view: "files" }));
    expect(html).toContain('data-view="files"');
    expect(html).not.toContain('class="future-workspace-body"');
  });

  it("restores and pairs two chosen windows while preserving their resources and other windows", () => {
    const initial: WindowInstanceManagerState = {
      focused: "desktop", nextZ: 4,
      instances: {
        "notes:first": { id: "notes:first", app: "notes", target: { kind: "text", itemId: "draft-a" }, minimized: true, maximized: true, z: 1 },
        "notes:second": { id: "notes:second", app: "notes", target: { kind: "text", itemId: "draft-b" }, minimized: true, maximized: false, z: 2 },
        "calculator:main": { id: "calculator:main", app: "calculator", minimized: false, maximized: false, z: 4 },
      },
    };
    const next = pairWorkspaceWindows("notes:first", "notes:second").reduce(windowInstanceReducer, initial);
    expect(next.instances["notes:first"]).toMatchObject({ snapMode: "left", minimized: false, maximized: false, target: { itemId: "draft-a" } });
    expect(next.instances["notes:second"]).toMatchObject({ snapMode: "right", minimized: false, maximized: false, target: { itemId: "draft-b" } });
    expect(next.focused).toBe("notes:second");
    expect(next.instances["calculator:main"]).toEqual(initial.instances["calculator:main"]);
    expect(initial.instances["notes:first"]?.minimized).toBe(true);
  });

  it("offers the most recent window from the file desktop and distinguishes multi-window applications", () => {
    const shared: FutureWorkspaceProps = { ...props(), instances: {
      "notes:first": { id: "notes:first", app: "notes", title: "较早的草稿", minimized: true, maximized: false, z: 1 },
      "notes:second": { id: "notes:second", app: "notes", title: "最近的草稿", minimized: true, maximized: false, z: 2 },
    } };
    const files = renderToStaticMarkup(jsx(FutureWorkspace, { ...shared, view: "files" }));
    expect(files).toContain("继续最近窗口");
    expect(files).toContain("最近的草稿");
    expect(files).not.toContain("较早的草稿");
    expect(renderToStaticMarkup(jsx(FutureWorkspace, shared))).toContain("2 个窗口 · 选择窗口");
  });
});
