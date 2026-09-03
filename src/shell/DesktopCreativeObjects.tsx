"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DESKTOP_ICON_LONG_PRESS_MS,
  desktopIconClickAction,
  isCompactDesktopViewport,
  movedBeyondLongPressTolerance,
} from "../../app/desktopIconInteraction";
import {
  clampDesktopObjectPosition,
  desktopObjectSize,
  type DesktopObjectPosition,
  type DesktopObjectSize,
  type VisibleDesktopObject,
} from "../../app/desktopObjects";

type DesktopCreativeObjectsProps = {
  entries: VisibleDesktopObject[];
  selectedIds: string[];
  onSelect: (itemId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: (itemId: string) => void;
  onMove: (itemId: string, position: { x: number; y: number }) => void;
  onResize: (itemId: string, size: DesktopObjectSize) => void;
  onContextMenu: (itemId: string, x: number, y: number) => void;
};

type CreativeObjectProps = {
  entry: VisibleDesktopObject;
  selected: boolean;
  onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: DesktopObjectSize) => void;
  onContextMenu: (x: number, y: number) => void;
};

const MIN_OBJECT_SIZE = { width: 140, height: 120 };

function DesktopCreativeObject({
  entry,
  selected,
  onSelect,
  onOpen,
  onMove,
  onResize,
  onContextMenu,
}: CreativeObjectProps) {
  const { object, item } = entry;
  const [previewPosition, setPreviewPosition] = useState<DesktopObjectPosition | null>(null);
  const [previewSize, setPreviewSize] = useState<DesktopObjectSize | null>(null);
  const previewPositionRef = useRef(previewPosition);
  const previewSizeRef = useRef(previewSize);
  const objectRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; origin: { x: number; y: number } } | null>(null);
  const resize = useRef<{ x: number; y: number; origin: DesktopObjectSize } | null>(null);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const moved = useRef(false);
  const longPressed = useRef(false);
  const position = previewPosition ?? object;
  const size = previewSize ?? desktopObjectSize(object);

  const clearPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const showMenu = (x: number, y: number) => {
    if (longPressed.current) return;
    clearPress();
    longPressed.current = true;
    onContextMenu(x, y);
  };
  const start = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    moved.current = false;
    longPressed.current = false;
    const point = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (isCompactDesktopViewport()) {
      press.current = {
        ...point,
        timer: window.setTimeout(
          () => showMenu(point.x, point.y),
          DESKTOP_ICON_LONG_PRESS_MS,
        ),
      };
      return;
    }
    drag.current = { ...point, origin: { x: object.x, y: object.y } };
  };
  const update = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current) {
      if (!movedBeyondLongPressTolerance(press.current, {
        x: event.clientX,
        y: event.clientY,
      })) return;
      moved.current = true;
      clearPress();
      return;
    }
    if (!drag.current) return;
    const parent = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    const next = clampDesktopObjectPosition(
      {
        x: drag.current.origin.x + dx,
        y: drag.current.origin.y + dy,
      },
      parent,
      {
        width: event.currentTarget.offsetWidth,
        height: event.currentTarget.offsetHeight,
      },
    );
    previewPositionRef.current = next;
    setPreviewPosition(next);
  };
  const end = (event: ReactPointerEvent<HTMLButtonElement>) => {
    clearPress();
    if (drag.current && moved.current && previewPositionRef.current) {
      onMove(previewPositionRef.current);
    }
    drag.current = null;
    previewPositionRef.current = null;
    setPreviewPosition(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const contextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isCompactDesktopViewport()) {
      showMenu(press.current?.x ?? event.clientX, press.current?.y ?? event.clientY);
    } else {
      onContextMenu(event.clientX, event.clientY);
    }
  };
  const startResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || isCompactDesktopViewport()) return;
    event.preventDefault();
    event.stopPropagation();
    moved.current = true;
    resize.current = {
      x: event.clientX,
      y: event.clientY,
      origin: desktopObjectSize(object),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const active = resize.current;
    const parent = objectRef.current?.parentElement?.getBoundingClientRect();
    if (!active || !parent) return;
    const next = {
      width: Math.max(
        MIN_OBJECT_SIZE.width,
        Math.min(parent.width - object.x, active.origin.width + event.clientX - active.x),
      ),
      height: Math.max(
        MIN_OBJECT_SIZE.height,
        Math.min(parent.height - object.y, active.origin.height + event.clientY - active.y),
      ),
    };
    previewSizeRef.current = next;
    setPreviewSize(next);
  };
  const endResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (resize.current && previewSizeRef.current) onResize(previewSizeRef.current);
    resize.current = null;
    previewSizeRef.current = null;
    setPreviewSize(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => clearPress, []);
  useLayoutEffect(() => {
    const constrain = () => {
      if (isCompactDesktopViewport()) return;
      const element = objectRef.current;
      const parent = element?.parentElement?.getBoundingClientRect();
      if (!element || !parent) return;
      const currentSize = desktopObjectSize(object);
      const nextSize = {
        width: Math.max(MIN_OBJECT_SIZE.width, Math.min(parent.width, currentSize.width)),
        height: Math.max(MIN_OBJECT_SIZE.height, Math.min(parent.height, currentSize.height)),
      };
      const next = clampDesktopObjectPosition(
        object,
        parent,
        nextSize,
      );
      if (nextSize.width !== currentSize.width || nextSize.height !== currentSize.height) {
        onResize(nextSize);
      }
      if (next.x !== object.x || next.y !== object.y) onMove(next);
    };
    constrain();
    window.addEventListener("resize", constrain);
    return () => window.removeEventListener("resize", constrain);
  }, [object, onMove, onResize]);

  return (
    <button
      ref={objectRef}
      type="button"
      className={`desktop-creative-object ${object.kind} ${selected ? "selected" : ""} ${drag.current ? "dragging" : ""}`}
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
      aria-label={`${item.name}，${object.kind === "photo-card" ? "照片卡片" : "文字便笺"}`}
      onPointerDown={start}
      onPointerMove={update}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(event) => {
        event.stopPropagation();
        const action = desktopIconClickAction(
          isCompactDesktopViewport(),
          longPressed.current,
          moved.current,
          "select",
        );
        longPressed.current = false;
        if (action === "open") onOpen();
        else if (action === "select") onSelect(event);
      }}
      onDoubleClick={() => {
        if (!isCompactDesktopViewport() && !moved.current) onOpen();
      }}
      onContextMenu={contextMenu}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
        if (event.shiftKey && event.key === "F10") {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onContextMenu(rect.left + 24, rect.top + 24);
        }
      }}
    >
      {object.kind === "photo-card" ? (
        <>
          <span className="creative-photo-frame">
            <img src={item.content} alt="" draggable={false} />
          </span>
          <strong>{item.name}</strong>
        </>
      ) : (
        <>
          <span className="creative-note-pin" aria-hidden="true" />
          <strong>{item.name}</strong>
          <span className="creative-note-copy">
            {item.content.trim().replace(/\s+/g, " ").slice(0, 180) || "空白文稿"}
          </span>
        </>
      )}
      <span
        className="creative-object-resize"
        aria-hidden="true"
        onPointerDown={startResize}
        onPointerMove={updateResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    </button>
  );
}

export default function DesktopCreativeObjects({
  entries,
  selectedIds,
  onSelect,
  onOpen,
  onMove,
  onResize,
  onContextMenu,
}: DesktopCreativeObjectsProps) {
  return (
    <>
      {entries.map((entry) => (
        <DesktopCreativeObject
          key={entry.object.itemId}
          entry={entry}
          selected={selectedIds.includes(entry.object.itemId)}
          onSelect={(event) => onSelect(entry.object.itemId, event)}
          onOpen={() => onOpen(entry.object.itemId)}
          onMove={(position) => onMove(entry.object.itemId, position)}
          onResize={(size) => onResize(entry.object.itemId, size)}
          onContextMenu={(x, y) => onContextMenu(entry.object.itemId, x, y)}
        />
      ))}
    </>
  );
}
