"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useWindowInstance, useWindowRuntime } from "../windows/WindowRuntime";
import { clampDesktopObjectPosition } from "../../../app/desktopObjects";
import "./desktopWidget.css";

export function useDesktopPin() {
  const [pinned, setPinned] = useState(false);
  const { id } = useWindowInstance();
  const { minimizeInstance, focusInstance } = useWindowRuntime();
  return {
    pinned,
    pin: () => { setPinned(true); minimizeInstance(id); },
    unpin: () => { setPinned(false); focusInstance(id); },
    open: () => focusInstance(id),
  };
}

export function PinButton({ pin }: { pin: ReturnType<typeof useDesktopPin> }) {
  return <button className="desktop-pin-button" aria-pressed={pin.pinned} onClick={pin.pinned ? pin.unpin : pin.pin}><span aria-hidden="true">⌖</span>{pin.pinned ? "取消桌面固定" : "钉到桌面"}</button>;
}

export default function DesktopWidget({ title, className, width, offset, onOpen, onUnpin, children, initialPosition = null, onPositionChange, openLabel = `打开完整${title}`, openIcon = "↗", removeTitle = "取消固定，返回窗口" }: {
  title: string; className: string; width: number; offset: { right: number; top: number };
  onOpen: () => void; onUnpin: () => void; children: ReactNode;
  initialPosition?: { x: number; y: number } | null;
  onPositionChange?: (position: { x: number; y: number }) => void;
  openLabel?: string; openIcon?: string; removeTitle?: string;
}) {
  const { desktopSurface } = useWindowRuntime();
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(initialPosition);
  const move = (x: number, y: number) => {
    const card = ref.current!;
    const next = clampDesktopObjectPosition({ x, y }, card.parentElement!.getBoundingClientRect(), { width: card.offsetWidth, height: card.offsetHeight });
    setPosition(next);
    return next;
  };
  if (!desktopSurface) return null;
  return createPortal(<section ref={ref} aria-label={`桌面${title}`} className={`nova-desktop-widget ${className}`}
    style={{ "--widget-width": `${width}px`, "--widget-right": `${offset.right}px`, "--widget-top": `${offset.top}px`, ...(position ? { left: `min(${position.x}px, max(0px, calc(100% - ${width}px)))`, top: position.y, right: "auto" } : {}) } as CSSProperties}
    onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    <header className="desktop-widget-toolbar">
      <button className="desktop-widget-handle" aria-label={`移动${title}`} title="拖动摆放，方向键微调"
        onPointerDown={event => {
          if (event.button !== 0) return;
          const card = ref.current!;
          drag.current = { x: event.clientX, y: event.clientY, left: card.offsetLeft, top: card.offsetTop };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => { if (drag.current) move(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y); }}
        onPointerUp={event => {
          if (drag.current) onPositionChange?.(move(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y));
          drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => {
          const steps: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
          if (!steps[event.key]) return;
          event.preventDefault(); event.stopPropagation();
          const [dx, dy] = steps[event.key];
          const next = move(ref.current!.offsetLeft + dx, ref.current!.offsetTop + dy);
          onPositionChange?.(next);
        }}><span aria-hidden="true">⠿</span>{title}</button>
      <button aria-label={openLabel} title={openLabel} onClick={onOpen}>{openIcon}</button>
      <button aria-label={`取消固定${title}`} title={removeTitle} onClick={onUnpin}>×</button>
    </header>
    {children}
  </section>, desktopSurface);
}
