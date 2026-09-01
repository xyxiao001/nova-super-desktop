"use client";

import type { AppDefinition, WindowAppId } from "../platform/apps/appRegistry";
import type { DesktopFocus, WindowStateMap } from "../platform/windows/windowState";

export type TaskbarMenuState = { app: WindowAppId; x: number };

type DesktopTaskbarProps = {
  apps: AppDefinition[];
  windows: WindowStateMap;
  focused: DesktopFocus;
  clock: string;
  notificationCount: number;
  startOpen: boolean;
  previewApp: WindowAppId | null;
  menu: TaskbarMenuState | null;
  menuApp: AppDefinition | null;
  labelFor: (app: AppDefinition) => string;
  onPreviewChange: (app: WindowAppId | null) => void;
  onMenuChange: (menu: TaskbarMenuState | null) => void;
  onRevealChange: (revealed: boolean) => void;
  onToggleStart: () => void;
  onActivate: (app: WindowAppId) => void;
  onOpen: (app: WindowAppId) => void;
  onMinimize: (app: WindowAppId) => void;
  onToggleMaximize: (app: WindowAppId) => void;
  onClose: (app: WindowAppId) => void;
  onOpenCalendar: () => void;
  canHide: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function DesktopTaskbar({
  apps,
  windows,
  focused,
  clock,
  notificationCount,
  startOpen,
  previewApp,
  menu,
  menuApp,
  labelFor,
  onPreviewChange,
  onMenuChange,
  onRevealChange,
  onToggleStart,
  onActivate,
  onOpen,
  onMinimize,
  onToggleMaximize,
  onClose,
  onOpenCalendar,
  canHide,
}: DesktopTaskbarProps) {
  return (
    <>
      <button
        className="taskbar-reveal-zone"
        type="button"
        tabIndex={-1}
        aria-label="显示任务栏"
        onPointerEnter={() => onRevealChange(true)}
      />
      <nav
        className="windows-taskbar"
        aria-label="任务栏"
        onPointerEnter={() => onRevealChange(true)}
        onPointerLeave={() => {
          onPreviewChange(null);
          if (canHide) onRevealChange(false);
        }}
      >
        <div className="taskbar-center">
          <button
            className={`start-button ${startOpen ? "selected" : ""}`}
            onClick={onToggleStart}
            aria-label="开始"
          >
            <span>
              <i />
              <i />
              <i />
              <i />
            </span>
          </button>
          {apps.map((app) => {
            const label = labelFor(app);
            const state = windows[app.id];
            return (
              <div
                className="taskbar-entry"
                key={app.id}
                onPointerEnter={() => onPreviewChange(app.id)}
                onFocusCapture={() => onPreviewChange(app.id)}
              >
                <button
                  className={`task-app ${app.id === "photo" ? "photo-lab-app" : `${app.kind}-app`} ${state.open ? "active" : ""} ${focused === app.id && !state.minimized ? "selected" : ""}`}
                  onClick={() => {
                    onPreviewChange(null);
                    onActivate(app.id);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPreviewChange(null);
                    onMenuChange({
                      app: app.id,
                      x: clamp(event.clientX - 92, 8, window.innerWidth - 192),
                    });
                    onRevealChange(true);
                  }}
                  aria-label={`打开${label}`}
                  title={label}
                >
                  <span>{app.taskbarIcon ?? app.icon}</span>
                </button>
                {state.open && previewApp === app.id && (
                  <aside className="taskbar-preview">
                    <header>
                      <span className={`app-glyph ${app.id}-glyph`}>
                        {app.windowIcon ?? app.icon}
                      </span>
                      <strong>{label}</strong>
                      <button aria-label={`关闭${label}`} onClick={() => onClose(app.id)}>
                        ×
                      </button>
                    </header>
                    <div>
                      <span>
                        {state.minimized
                          ? "已最小化"
                          : state.maximized
                            ? "已最大化"
                            : "正在运行"}
                      </span>
                      <i className={`${app.kind}-preview-mark`}>
                        {app.windowIcon ?? app.icon}
                      </i>
                    </div>
                  </aside>
                )}
              </div>
            );
          })}
        </div>
        <div className="taskbar-tray">
          <span>⌃</span>
          <span>⌁</span>
          <span className={notificationCount ? "notification-mark active" : "notification-mark"}>
            ▰
          </span>
          <button className="taskbar-clock" aria-label="打开日历" onClick={onOpenCalendar}>
            {clock}
          </button>
        </div>
      </nav>
      {menu && menuApp && (
        <div className="taskbar-window-menu" style={{ left: menu.x }}>
          <strong>{labelFor(menuApp)}</strong>
          <button onClick={() => onOpen(menu.app)}>切换到窗口</button>
          {windows[menu.app].open && (
            <>
              <button
                onClick={() =>
                  windows[menu.app].minimized ? onOpen(menu.app) : onMinimize(menu.app)
                }
              >
                {windows[menu.app].minimized ? "还原" : "最小化"}
              </button>
              <button onClick={() => onToggleMaximize(menu.app)}>
                {windows[menu.app].maximized ? "还原窗口" : "最大化"}
              </button>
              <span />
              <button className="danger" onClick={() => onClose(menu.app)}>
                关闭窗口
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
