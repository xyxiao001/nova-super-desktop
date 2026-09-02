"use client";

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import AppLoadBoundary from "../../app/AppLoadBoundary";
import { APP_REGISTRY } from "../platform/apps/appRegistry";
import { isCompactDesktopViewport } from "../../app/desktopIconInteraction";
import type { WindowAppId } from "../platform/apps/appRegistry";
import {
  canMeasureWindowGeometry,
  centeredWindowGeometry,
  edgeSnapMode,
  fitWindowGeometry,
  offsetWindowGeometry,
  snappedWindowGeometry,
  type WindowGeometry,
  type WindowSnapMode,
} from "../platform/windows/windowGeometry";
import type { WindowInstanceId } from "../platform/windows/windowInstanceState";

const WINDOW_GEOMETRY_PREFIX = "nova-window-geometry:";
const WINDOW_MENU_HOLD_MS = 450;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const fitAppWindowGeometry = (
  app: WindowAppId,
  geometry: WindowGeometry,
): WindowGeometry => {
  const minimum = APP_REGISTRY[app].window;
  return fitWindowGeometry(
    geometry,
    window.innerWidth,
    window.innerHeight,
    minimum.minWidth,
    minimum.minHeight,
  );
};

const readWindowGeometry = (app: WindowAppId, instanceId: WindowInstanceId) => {
  if (isCompactDesktopViewport()) return null;
  const key = `${WINDOW_GEOMETRY_PREFIX}${app}`;
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const geometry = JSON.parse(saved) as WindowGeometry;
    const minimum = APP_REGISTRY[app].window;
    if (
      ![geometry.x, geometry.y, geometry.width, geometry.height].every(Number.isFinite) ||
      geometry.width < (minimum.minWidth ?? 320) ||
      geometry.height < (minimum.minHeight ?? 260)
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return fitAppWindowGeometry(app, offsetWindowGeometry(geometry, instanceId));
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export type WindowFrameProps = {
  instanceId: WindowInstanceId;
  app: WindowAppId;
  title: string;
  icon: string;
  minimized: boolean;
  maximized: boolean;
  snapMode?: WindowSnapMode;
  focused: boolean;
  zIndex: number;
  taskbarPreviewing?: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onSnap: (mode: WindowSnapMode) => void;
  onUnsnap: () => void;
  children: ReactNode;
};

export default function WindowFrame({
  instanceId,
  app,
  title,
  icon,
  minimized,
  maximized,
  snapMode,
  focused,
  zIndex,
  taskbarPreviewing = false,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onSnap,
  onUnsnap,
  children,
}: WindowFrameProps) {
  const windowConfig = APP_REGISTRY[app].window;
  const [geometry, setGeometry] = useState<WindowGeometry | null>(() =>
    readWindowGeometry(app, instanceId),
  );
  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const [systemFullscreen, setSystemFullscreen] = useState(() =>
    typeof document !== "undefined" && document.fullscreenElement !== null,
  );
  const [taskbarPreviewStyle, setTaskbarPreviewStyle] = useState<CSSProperties>();
  const windowRef = useRef<HTMLElement>(null);
  const snapControlRef = useRef<HTMLDivElement>(null);
  const menuHoldTimer = useRef<number | null>(null);
  const suppressMaximizeClick = useRef(false);
  const drag = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const resize = useRef<{
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!minimized || !taskbarPreviewing) {
      setTaskbarPreviewStyle(undefined);
      return;
    }
    const element = windowRef.current;
    const target = document.querySelector<HTMLElement>(
      `[data-window-preview-target="${CSS.escape(instanceId)}"]`,
    );
    if (!element || !target) return;
    const updatePreview = () => {
      const targetRect = target.getBoundingClientRect();
      const sourceWidth = element.offsetWidth;
      const sourceHeight = element.offsetHeight;
      const scale = Math.min(targetRect.width / sourceWidth, targetRect.height / sourceHeight);
      setTaskbarPreviewStyle({
        left: targetRect.left + (targetRect.width - sourceWidth * scale) / 2,
        top: targetRect.top + (targetRect.height - sourceHeight * scale) / 2,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        zIndex: 112,
      });
    };
    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(target);
    window.addEventListener("resize", updatePreview);
    target.closest(".taskbar-preview")?.addEventListener("scroll", updatePreview);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePreview);
      target.closest(".taskbar-preview")?.removeEventListener("scroll", updatePreview);
    };
  }, [instanceId, minimized, taskbarPreviewing]);

  useLayoutEffect(() => {
    const element = windowRef.current;
    if (!element || isCompactDesktopViewport()) return;
    const rect = element.getBoundingClientRect();
    const initialGeometry = offsetWindowGeometry({
      x: (window.innerWidth - rect.width) / 2,
      y: (window.innerHeight - 49 - rect.height) / 2,
      width: rect.width,
      height: rect.height,
    }, instanceId);
    setGeometry((current) =>
      current
        ? fitAppWindowGeometry(app, current)
        : fitAppWindowGeometry(app, initialGeometry),
    );
  }, [app, instanceId]);

  useEffect(() => {
    if (snapMode && !isCompactDesktopViewport()) {
      setGeometry(snappedWindowGeometry(snapMode, window.innerWidth, window.innerHeight));
    }
  }, [snapMode]);

  useEffect(() => {
    const element = windowRef.current;
    if (!element || minimized || maximized || isCompactDesktopViewport()) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const isMinimized = element.classList.contains("minimized");
      const isMaximized = element.classList.contains("maximized");
      if (!canMeasureWindowGeometry(isMinimized, isMaximized, rect.width, rect.height)) return;
      setGeometry((current) => {
        if (!current) return current;
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        return width === Math.round(current.width) && height === Math.round(current.height)
          ? current
          : fitAppWindowGeometry(app, { ...current, width, height });
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [app, maximized, minimized]);

  useEffect(() => {
    const resizeWindow = () => {
      if (isCompactDesktopViewport()) return;
      setGeometry((current) =>
        snapMode
          ? snappedWindowGeometry(snapMode, window.innerWidth, window.innerHeight)
          : current
            ? fitAppWindowGeometry(app, current)
            : current,
      );
    };
    window.addEventListener("resize", resizeWindow);
    return () => window.removeEventListener("resize", resizeWindow);
  }, [app, snapMode]);

  useEffect(() => {
    const syncFullscreen = () => setSystemFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!windowMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!snapControlRef.current?.contains(event.target as Node)) {
        setWindowMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWindowMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [windowMenuOpen]);

  useEffect(() => () => {
    if (menuHoldTimer.current !== null) window.clearTimeout(menuHoldTimer.current);
  }, []);

  const saveGeometryTemplate = (next: WindowGeometry) => {
    if (!isCompactDesktopViewport()) {
      localStorage.setItem(`${WINDOW_GEOMETRY_PREFIX}${app}`, JSON.stringify(next));
    }
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      maximized ||
      isCompactDesktopViewport() ||
      (event.target as HTMLElement).closest(".window-controls")
    ) {
      return;
    }
    const element = windowRef.current;
    if (!element) return;
    event.preventDefault();
    onFocus();
    const rect = element.getBoundingClientRect();
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    const element = windowRef.current;
    if (!current || !element) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      current.moved = true;
      onUnsnap();
    }
    if (!current.moved) return;
    const rect = element.getBoundingClientRect();
    const x = clamp(current.originX + dx, 0, Math.max(0, window.innerWidth - 120));
    const y = clamp(current.originY + dy, 0, Math.max(0, window.innerHeight - 87));
    const next = {
      x,
      y,
      width: geometry?.width ?? rect.width,
      height: geometry?.height ?? rect.height,
    };
    setGeometry(next);
    saveGeometryTemplate(next);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current.moved) return;
    const snap = edgeSnapMode(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
    if (snap === "maximize") onMaximize();
    else if (snap) onSnap(snap);
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (maximized || isCompactDesktopViewport() || event.button !== 0) return;
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    onUnsnap();
    resize.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = resize.current;
    const element = windowRef.current;
    if (!current || !element) return;
    const rect = element.getBoundingClientRect();
    const minimum = windowConfig;
    const width = clamp(
      current.width + event.clientX - current.startX,
      minimum.minWidth ?? 320,
      Math.max(minimum.minWidth ?? 320, window.innerWidth - rect.left - 4),
    );
    const height = clamp(
      current.height + event.clientY - current.startY,
      minimum.minHeight ?? 260,
      Math.max(minimum.minHeight ?? 260, window.innerHeight - 49 - rect.top),
    );
    const next = {
      x: geometry?.x ?? rect.left,
      y: geometry?.y ?? rect.top,
      width,
      height,
    };
    setGeometry(next);
    saveGeometryTemplate(next);
  };

  const endResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resize.current) return;
    resize.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const clearMenuHold = () => {
    if (menuHoldTimer.current === null) return;
    window.clearTimeout(menuHoldTimer.current);
    menuHoldTimer.current = null;
  };
  const startMenuHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isCompactDesktopViewport()) return;
    clearMenuHold();
    suppressMaximizeClick.current = false;
    menuHoldTimer.current = window.setTimeout(() => {
      menuHoldTimer.current = null;
      suppressMaximizeClick.current = true;
      setWindowMenuOpen(true);
    }, WINDOW_MENU_HOLD_MS);
  };
  const clickMaximize = () => {
    clearMenuHold();
    if (suppressMaximizeClick.current) {
      suppressMaximizeClick.current = false;
      return;
    }
    setWindowMenuOpen(false);
    onMaximize();
  };
  const centerWindow = () => {
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (maximized) onMaximize();
    onUnsnap();
    const next = centeredWindowGeometry(
      geometry ?? { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      window.innerWidth,
      window.innerHeight,
      windowConfig.minWidth,
      windowConfig.minHeight,
    );
    setGeometry(next);
    saveGeometryTemplate(next);
    setWindowMenuOpen(false);
  };
  const maximizeWindow = () => {
    if (!maximized) onMaximize();
    setWindowMenuOpen(false);
  };
  const toggleSystemFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error("Unable to change system fullscreen state", error);
    } finally {
      setWindowMenuOpen(false);
    }
  };
  const initial = windowConfig.initial;
  const tablet = windowConfig.tablet;
  const manifestStyle = {
    "--window-inset": initial?.inset,
    "--window-width": initial?.width,
    "--window-height": initial?.height,
    "--window-left": initial?.left,
    "--window-top": initial?.top,
    "--window-min-width": windowConfig.minWidth
      ? `min(${windowConfig.minWidth}px, calc(100vw - 8px))`
      : undefined,
    "--window-min-height": windowConfig.minHeight
      ? `min(${windowConfig.minHeight}px, calc(100vh - 57px))`
      : undefined,
    "--window-tablet-inset": tablet?.inset,
    "--window-tablet-width": tablet?.width,
    "--window-tablet-left": tablet?.left,
    "--window-tablet-top": tablet?.top,
  } as CSSProperties;
  const style: CSSProperties = taskbarPreviewStyle
    ? {
        ...manifestStyle,
        ...(geometry ? { width: geometry.width, height: geometry.height } : {}),
        ...taskbarPreviewStyle,
      }
    : geometry && !maximized
      ? {
          ...manifestStyle,
          left: geometry.x,
          top: geometry.y,
          width: geometry.width,
          height: geometry.height,
          right: "auto",
          bottom: "auto",
          zIndex,
        }
      : { ...manifestStyle, zIndex };

  return (
    <section
      ref={windowRef}
      data-window-instance={instanceId}
      className={`desktop-window ${app}-window window-size-${windowConfig.size} ${tablet?.inset ? "window-tablet-inset" : ""} ${minimized ? "minimized" : ""} ${taskbarPreviewing ? "taskbar-live-preview" : ""} ${maximized && !taskbarPreviewing ? "maximized" : ""} ${focused ? "focused" : ""}`}
      style={style}
      onPointerDown={onFocus}
    >
      <div
        className="window-chrome"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => {
          if (!isCompactDesktopViewport()) onMaximize();
        }}
      >
        <div className="window-identity">
          <span className={`app-glyph ${app}-glyph`}>{icon}</span>
          <strong>{title}</strong>
        </div>
        <div className="window-controls windows-controls">
          <button className="window-minimize" aria-label={`最小化${title}`} onClick={onMinimize}>
            —
          </button>
          <div
            ref={snapControlRef}
            className="snap-control"
          >
            <button
              className="window-maximize"
              aria-label={maximized ? `还原${title}` : `最大化${title}`}
              aria-haspopup="menu"
              aria-expanded={windowMenuOpen}
              onPointerDown={startMenuHold}
              onPointerUp={clearMenuHold}
              onPointerCancel={clearMenuHold}
              onPointerLeave={clearMenuHold}
              onContextMenu={(event) => {
                event.preventDefault();
                setWindowMenuOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return;
                event.preventDefault();
                setWindowMenuOpen(true);
              }}
              onClick={clickMaximize}
            >
              □
            </button>
            {windowMenuOpen && (
              <div className="window-layout-menu" role="menu" aria-label="调整窗口">
                <strong>调整窗口</strong>
                <button role="menuitem" onClick={centerWindow}>
                  <span className="window-layout-icon center" aria-hidden="true"><i /></span>
                  窗口居中
                </button>
                <button role="menuitem" aria-current={maximized ? "true" : undefined} onClick={maximizeWindow}>
                  <span className="window-layout-icon maximize" aria-hidden="true"><i /></span>
                  窗口全屏
                </button>
                <button role="menuitem" onClick={() => void toggleSystemFullscreen()}>
                  <span className="window-layout-icon fullscreen" aria-hidden="true"><i /></span>
                  {systemFullscreen ? "退出系统全屏" : "系统全屏"}
                </button>
              </div>
            )}
          </div>
          <button className="window-close" aria-label={`关闭${title}`} onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="window-content">
        <AppLoadBoundary appName={title}>{children}</AppLoadBoundary>
      </div>
      {!maximized && (
        <button
          className="window-resize-handle"
          aria-label={`调整${title}窗口大小`}
          title="拖动调整窗口大小"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
        />
      )}
    </section>
  );
}
