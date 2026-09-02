"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { AppDefinition, WindowAppId } from "../platform/apps/appRegistry";
import type {
  WindowInstance,
  WindowInstanceId,
  WindowInstanceMap,
} from "../platform/windows/windowInstanceState";
import { allWindowInstances } from "../platform/windows/windowInstanceState";

export type TaskbarMenuState = { app: WindowAppId; x: number };

type DesktopTaskbarProps = {
  apps: AppDefinition[];
  instances: WindowInstanceMap;
  focused: "desktop" | WindowInstanceId;
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
  onActivateInstance: (id: WindowInstanceId) => void;
  onOpen: (app: WindowAppId) => void;
  onNewWindow: (app: WindowAppId) => void;
  onMinimize: (id: WindowInstanceId) => void;
  onToggleMaximize: (id: WindowInstanceId) => void;
  onClose: (id: WindowInstanceId) => void;
  onCloseAll: (app: WindowAppId) => void;
  onOpenCalendar: () => void;
  canHide: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const TASKBAR_PREVIEW_ITEM_WIDTH = 210;
const TASKBAR_PREVIEW_BORDER_WIDTH = 2;
const TASKBAR_PREVIEW_EDGE_GAP = 8;
const TASKBAR_PREVIEW_MAX_VISIBLE_ITEMS = 4;

type TaskbarPreviewLayoutInput = {
  anchorCenter: number;
  instanceCount: number;
  viewportWidth: number;
};

export type TaskbarPreviewLayout = {
  left: number;
  width: number;
  scrollable: boolean;
};

export function taskbarPreviewLayout({
  anchorCenter,
  instanceCount,
  viewportWidth,
}: TaskbarPreviewLayoutInput): TaskbarPreviewLayout {
  const count = Math.max(1, instanceCount);
  const availableWidth = Math.max(0, viewportWidth - TASKBAR_PREVIEW_EDGE_GAP * 2);
  const visibleCount = Math.min(
    count,
    TASKBAR_PREVIEW_MAX_VISIBLE_ITEMS,
    Math.max(
      1,
      Math.floor(
        (availableWidth - TASKBAR_PREVIEW_BORDER_WIDTH) /
          TASKBAR_PREVIEW_ITEM_WIDTH,
      ),
    ),
  );
  const naturalWidth =
    count * TASKBAR_PREVIEW_ITEM_WIDTH + TASKBAR_PREVIEW_BORDER_WIDTH;
  const width = Math.min(
    availableWidth,
    visibleCount * TASKBAR_PREVIEW_ITEM_WIDTH +
      TASKBAR_PREVIEW_BORDER_WIDTH,
  );
  const left = clamp(
    anchorCenter - width / 2,
    TASKBAR_PREVIEW_EDGE_GAP,
    Math.max(
      TASKBAR_PREVIEW_EDGE_GAP,
      viewportWidth - width - TASKBAR_PREVIEW_EDGE_GAP,
    ),
  );

  return {
    left,
    width,
    scrollable: naturalWidth > width,
  };
}

const appInstances = (
  instances: WindowInstanceMap,
  app: WindowAppId,
): WindowInstance[] => allWindowInstances(instances)
  .filter((instance) => instance.app === app)
  .sort((left, right) => right.z - left.z);

export default function DesktopTaskbar({
  apps,
  instances,
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
  onActivateInstance,
  onOpen,
  onNewWindow,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCloseAll,
  onOpenCalendar,
  canHide,
}: DesktopTaskbarProps) {
  const taskbarEntryRefs = useRef(new Map<WindowAppId, HTMLDivElement>());
  const [previewPlacement, setPreviewPlacement] = useState<{
    app: WindowAppId;
    left: number;
    width: number;
    scrollable: boolean;
  } | null>(null);

  const positionPreview = useCallback((
    app: WindowAppId,
    instanceCount: number,
  ) => {
    const entry = taskbarEntryRefs.current.get(app);
    if (!entry) return;
    const entryRect = entry.getBoundingClientRect();
    const layout = taskbarPreviewLayout({
      anchorCenter: entryRect.left + entryRect.width / 2,
      instanceCount,
      viewportWidth: window.innerWidth,
    });
    setPreviewPlacement({
      app,
      left: layout.left - entryRect.left,
      width: layout.width,
      scrollable: layout.scrollable,
    });
  }, []);

  useLayoutEffect(() => {
    if (!previewApp) return;
    const update = () => {
      positionPreview(
        previewApp,
        appInstances(instances, previewApp).length,
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [instances, positionPreview, previewApp]);

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
            const running = appInstances(instances, app.id);
            const state = running[0];
            const placement = previewPlacement?.app === app.id
              ? previewPlacement
              : null;
            return (
              <div
                className="taskbar-entry"
                key={app.id}
                ref={(element) => {
                  if (element) taskbarEntryRefs.current.set(app.id, element);
                  else taskbarEntryRefs.current.delete(app.id);
                }}
                onPointerEnter={() => {
                  if (running.length) positionPreview(app.id, running.length);
                  onPreviewChange(app.id);
                }}
                onFocusCapture={() => {
                  if (running.length) positionPreview(app.id, running.length);
                  onPreviewChange(app.id);
                }}
              >
                <button
                  className={`task-app ${app.id === "photo" ? "photo-lab-app" : `${app.kind}-app`} ${state ? "active" : ""} ${state && focused === state.id && !state.minimized ? "selected" : ""}`}
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
                {state && previewApp === app.id && (
                  <aside
                    className={`taskbar-preview ${placement?.scrollable ? "scrollable" : ""}`}
                    style={placement ? {
                      left: placement.left,
                      width: placement.width,
                      transform: "none",
                    } : undefined}
                  >
                    {running.map((instance) => {
                      const instanceLabel = instance.taskbarTitle ?? instance.title ?? label;
                      return (
                        <section className="taskbar-preview-item" key={instance.id}>
                          <header>
                            <span className={`app-glyph ${app.id}-glyph`}>
                              {app.windowIcon ?? app.icon}
                            </span>
                            <strong>{instanceLabel}</strong>
                            <button aria-label={`关闭${instanceLabel}`} onClick={() => onClose(instance.id)}>
                              ×
                            </button>
                          </header>
                          <button
                            className={`taskbar-preview-body ${instance.minimized ? "live" : ""}`}
                            data-window-preview-target={instance.id}
                            onClick={() => {
                              onPreviewChange(null);
                              onActivateInstance(instance.id);
                            }}
                          >
                            <span>
                              {instance.minimized
                                ? "已最小化"
                                : instance.maximized
                                  ? "已最大化"
                                  : "正在运行"}
                            </span>
                            <i className={`${app.kind}-preview-mark`}>
                              {app.windowIcon ?? app.icon}
                            </i>
                          </button>
                        </section>
                      );
                    })}
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
      {menu && menuApp && (() => {
        const running = appInstances(instances, menu.app);
        const state = running[0];
        return (
          <div className="taskbar-window-menu" style={{ left: menu.x }}>
            <strong>{labelFor(menuApp)}</strong>
            <button onClick={() => onOpen(menu.app)}>切换到窗口</button>
            {menuApp.window.instancePolicy === "multiple" && (
              <button className="new-window-command" onClick={() => onNewWindow(menu.app)}>
                新建窗口
              </button>
            )}
            {running.length > 1 && running.map((instance) => (
              <button key={instance.id} onClick={() => onActivateInstance(instance.id)}>
                {instance.taskbarTitle ?? instance.title ?? menuApp.label}
              </button>
            ))}
            {state && (
              <>
                {running.length === 1 && (
                  <>
                    <button
                      onClick={() =>
                        state.minimized ? onOpen(menu.app) : onMinimize(state.id)
                      }
                    >
                      {state.minimized ? "还原" : "最小化"}
                    </button>
                    <button onClick={() => onToggleMaximize(state.id)}>
                      {state.maximized ? "还原窗口" : "最大化"}
                    </button>
                  </>
                )}
                <span />
                <button className="danger" onClick={() => running.length > 1 ? onCloseAll(menu.app) : onClose(state.id)}>
                  {running.length > 1 ? "关闭所有窗口" : "关闭窗口"}
                </button>
              </>
            )}
          </div>
        );
      })()}
    </>
  );
}
