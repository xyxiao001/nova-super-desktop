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
  edgeSnapMode,
  fitWindowGeometry,
  snappedWindowGeometry,
  type WindowGeometry,
  type WindowSnapMode,
} from "../platform/windows/windowGeometry";

const WINDOW_GEOMETRY_PREFIX = "nova-window-geometry:";

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

const readWindowGeometry = (app: WindowAppId) => {
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
    return fitAppWindowGeometry(app, geometry);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export type WindowFrameProps = {
  app: WindowAppId;
  title: string;
  icon: string;
  minimized: boolean;
  maximized: boolean;
  snapMode?: WindowSnapMode;
  focused: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onSnap: (mode: WindowSnapMode) => void;
  onUnsnap: () => void;
  children: ReactNode;
};

export default function WindowFrame({
  app,
  title,
  icon,
  minimized,
  maximized,
  snapMode,
  focused,
  zIndex,
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
    readWindowGeometry(app),
  );
  const [snapPickerOpen, setSnapPickerOpen] = useState(false);
  const windowRef = useRef<HTMLElement>(null);
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
    const element = windowRef.current;
    if (!element || isCompactDesktopViewport()) return;
    const rect = element.getBoundingClientRect();
    setGeometry((current) =>
      current
        ? fitAppWindowGeometry(app, current)
        : fitAppWindowGeometry(app, {
            x: (window.innerWidth - rect.width) / 2,
            y: (window.innerHeight - 49 - rect.height) / 2,
            width: rect.width,
            height: rect.height,
          }),
    );
  }, [app]);

  useEffect(() => {
    if (snapMode && !isCompactDesktopViewport()) {
      setGeometry(snappedWindowGeometry(snapMode, window.innerWidth, window.innerHeight));
    }
  }, [snapMode]);

  useEffect(() => {
    if (geometry && !isCompactDesktopViewport()) {
      localStorage.setItem(`${WINDOW_GEOMETRY_PREFIX}${app}`, JSON.stringify(geometry));
    }
  }, [app, geometry]);

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
    setGeometry((value) => ({
      x,
      y,
      width: value?.width ?? rect.width,
      height: value?.height ?? rect.height,
    }));
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
    setGeometry((value) => ({
      x: value?.x ?? rect.left,
      y: value?.y ?? rect.top,
      width,
      height,
    }));
  };

  const endResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resize.current) return;
    resize.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const chooseSnap = (mode: WindowSnapMode) => {
    onSnap(mode);
    setSnapPickerOpen(false);
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
  const style: CSSProperties =
    geometry && !maximized
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
      className={`desktop-window window-size-${windowConfig.size} ${tablet?.inset ? "window-tablet-inset" : ""} ${minimized ? "minimized" : ""} ${maximized ? "maximized" : ""} ${focused ? "focused" : ""}`}
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
            className="snap-control"
            onPointerEnter={() => setSnapPickerOpen(true)}
            onPointerLeave={() => setSnapPickerOpen(false)}
            onFocusCapture={() => setSnapPickerOpen(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setSnapPickerOpen(false);
              }
            }}
          >
            <button
              className="window-maximize"
              aria-label={maximized ? `还原${title}` : `最大化${title}`}
              onClick={onMaximize}
            >
              □
            </button>
            {snapPickerOpen && (
              <aside className="snap-picker" aria-label="窗口贴靠布局">
                <strong>贴靠布局</strong>
                <div>
                  <button aria-label="贴靠到左半屏" onClick={() => chooseSnap("left")}>
                    <i />
                    <i />
                  </button>
                  <button aria-label="贴靠到右半屏" onClick={() => chooseSnap("right")}>
                    <i />
                    <i />
                  </button>
                  <button aria-label="贴靠到左上角" onClick={() => chooseSnap("top-left")}>
                    <i />
                    <i />
                    <i />
                    <i />
                  </button>
                  <button aria-label="贴靠到右上角" onClick={() => chooseSnap("top-right")}>
                    <i />
                    <i />
                    <i />
                    <i />
                  </button>
                  <button aria-label="贴靠到左下角" onClick={() => chooseSnap("bottom-left")}>
                    <i />
                    <i />
                    <i />
                    <i />
                  </button>
                  <button aria-label="贴靠到右下角" onClick={() => chooseSnap("bottom-right")}>
                    <i />
                    <i />
                    <i />
                    <i />
                  </button>
                </div>
              </aside>
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
