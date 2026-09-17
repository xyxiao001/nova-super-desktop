import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DesktopItem } from "../../app/desktopFiles";
import type { DesktopSaveStatus } from "../../app/desktopStorage";

const runtime = vi.hoisted(() => ({ status: "saved" as DesktopSaveStatus, source: undefined as DesktopItem["readerSource"], launchIntent: null as import("../../app/appLaunch").AppLaunchIntent | null }));
const note: DesktopItem = { id: "note", type: "text", name: "draft.txt", content: "尚未保存的正文", parentId: null, createdAt: 1 };
vi.mock("../../src/platform/launch/LaunchRuntime", () => ({
  useAppLaunchIntent: () => ({ launchIntent: runtime.launchIntent, onLaunchHandled: vi.fn() }),
}));
vi.mock("../../src/platform/workspace/WorkspaceRuntime", () => ({
  useWorkspaceRuntime: () => ({ visibleItems: [{ ...note, readerSource: runtime.source }], getSaveStatus: () => runtime.status, downloadItem: vi.fn(), openReaderSource: vi.fn() }),
}));
vi.mock("../../src/platform/windows/WindowRuntime", () => ({
  useWindowInstance: () => ({ id: "notes:note", target: { kind: "text", itemId: "note" } }),
  useWindowRuntime: () => ({ retargetInstance: vi.fn() }),
  useWindowTitle: vi.fn(),
}));
import NotepadApp from "../../src/apps/notes/entry";

describe("notepad save feedback", () => {
  it.each([
    ["saved", "已保存到本机"],
    ["saving", "保存中…"],
    ["error", "保存失败"],
  ] as const)("renders %s from workspace status", (status, label) => {
    runtime.status = status;
    const html = renderToStaticMarkup(jsx(NotepadApp, {}));
    expect(html).toContain(label);
    expect(html).not.toContain("已自动保存");
    expect(html).toContain(note.content);
    if (status === "error") expect(html).toContain("导出当前 TXT");
    else expect(html).not.toContain("导出当前 TXT");
  });

  it("shows a backlink only for sourced excerpts", () => {
    runtime.status = "saved";
    runtime.source = { bookId: "book", bookTitle: "围城", bookVersion: "v1", chapterId: "chapter:1", chapterTitle: "第一章", paragraphIndex: 0, characterOffset: 2 };
    const sourced = renderToStaticMarkup(jsx(NotepadApp, {}));
    expect(sourced).toContain("摘自《围城》 · 第一章");
    expect(sourced).toContain("返回原文");
    runtime.source = undefined;
    expect(renderToStaticMarkup(jsx(NotepadApp, {}))).not.toContain("返回原文");
  });
});
