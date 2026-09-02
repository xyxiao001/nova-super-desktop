import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { APP_REGISTRY } from "../../src/platform/apps/appRegistry";
import DesktopTaskbar from "../../src/shell/DesktopTaskbar";
import type { WindowInstanceMap } from "../../src/platform/windows/windowInstanceState";

describe("desktop taskbar", () => {
  it("groups multiple application windows under one taskbar entry", () => {
    const instances: WindowInstanceMap = {
      "explorer:first": {
        id: "explorer:first",
        app: "explorer",
        minimized: false,
        maximized: false,
        z: 2,
        taskbarTitle: "项目资料",
      },
      "explorer:second": {
        id: "explorer:second",
        app: "explorer",
        minimized: false,
        maximized: false,
        z: 3,
        taskbarTitle: "设计素材",
      },
    };
    const callback = vi.fn();

    const markup = renderToStaticMarkup(jsx(DesktopTaskbar, {
      apps: [APP_REGISTRY.explorer],
      instances,
      focused: "explorer:second",
      clock: "16:20",
      notificationCount: 0,
      startOpen: false,
      previewApp: "explorer",
      menu: { app: "explorer", x: 24 },
      menuApp: APP_REGISTRY.explorer,
      labelFor: () => "文件资源管理器",
      onPreviewChange: callback,
      onMenuChange: callback,
      onRevealChange: callback,
      onToggleStart: callback,
      onActivate: callback,
      onActivateInstance: callback,
      onOpen: callback,
      onNewWindow: callback,
      onMinimize: callback,
      onToggleMaximize: callback,
      onClose: callback,
      onCloseAll: callback,
      onOpenCalendar: callback,
      canHide: true,
    }));

    expect(markup.match(/class="taskbar-entry"/g)).toHaveLength(1);
    expect(markup).toContain("项目资料");
    expect(markup).toContain("设计素材");
    expect(markup).toContain("新建窗口");
    expect(markup).toContain("关闭所有窗口");
  });
});
