"use client";

import {
  useEffect,
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
import type {
  DesktopObject,
  VisibleDesktopObject,
} from "../../app/desktopObjects";

type DesktopCreativeObjectsProps = {
  entries: VisibleDesktopObject[];
  selectedIds: string[];
  onSelect: (itemId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: (itemId: string) => void;
  onMove: (itemId: string, position: { x: number; y: number }) => void;
  onContextMenu: (itemId: string, x: number, y: number) => void;
};

type CreativeObjectProps = {
  entry: VisibleDesktopObject;
  selected: boolean;
  onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onContextMenu: (x: number, y: number) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function DesktopCreativeObject({
  entry,
  selected,
  onSelect,
  onOpen,
  onMove,
  onContextMenu,
}: CreativeObjectProps) {
  const { object, item } = entry;
  const [previewPosition, setPreviewPosition] = useState<Pick<DesktopObject, "x" | "y"> | null>(null);
  const previewPositionRef = useRef(previewPosition);
  const drag = useRef<{ x: number; y: number; origin: { x: number; y: number } } | null>(null);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const moved = useRef(false);
  const longPressed = useRef(false);
  const position = previewPosition ?? object;

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
    const next = {
      x: clamp(
        drag.current.origin.x + dx,
        0,
        Math.max(0, parent.width - event.currentTarget.offsetWidth),
      ),
      y: clamp(
        drag.current.origin.y + dy,
        0,
        Math.max(0, parent.height - event.currentTarget.offsetHeight),
      ),
    };
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

  useEffect(() => clearPress, []);

  return (
    <button
      type="button"
      className={`desktop-creative-object ${object.kind} ${selected ? "selected" : ""} ${drag.current ? "dragging" : ""}`}
      style={{ left: position.x, top: position.y }}
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
    </button>
  );
}

export default function DesktopCreativeObjects({
  entries,
  selectedIds,
  onSelect,
  onOpen,
  onMove,
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
          onContextMenu={(x, y) => onContextMenu(entry.object.itemId, x, y)}
        />
      ))}
    </>
  );
}
