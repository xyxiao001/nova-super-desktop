"use client";

import {
  useEffect,
  useRef,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DESKTOP_ICON_LONG_PRESS_MS,
  desktopIconClickAction,
  isCompactDesktopViewport,
  movedBeyondLongPressTolerance,
} from "../../app/desktopIconInteraction";
import { hasDesktopFileDrag, type DesktopItem } from "../../app/desktopFiles";

export type IconPosition = { x: number; y: number };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function useDesktopIconInteraction(
  id: string,
  position: IconPosition | undefined,
  move: ((id: string, position: IconPosition) => void) | undefined,
  onLongPress: (x: number, y: number) => void,
  onPointerDrop?: (x: number, y: number) => void,
  desktopPointerMove = true,
) {
  const drag = useRef<{ x: number; y: number; origin: IconPosition } | null>(null);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const moved = useRef(false);
  const longPressed = useRef(false);
  const clearPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const triggerContextMenu = (x: number, y: number) => {
    if (longPressed.current) return;
    clearPress();
    longPressed.current = true;
    onLongPress(x, y);
  };
  const start = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    moved.current = false;
    longPressed.current = false;
    if (isCompactDesktopViewport()) {
      event.stopPropagation();
      const x = event.clientX;
      const y = event.clientY;
      if (position && move) {
        drag.current = { x, y, origin: position };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      press.current = {
        x,
        y,
        timer: window.setTimeout(() => triggerContextMenu(x, y), DESKTOP_ICON_LONG_PRESS_MS),
      };
      return;
    }
    if (!desktopPointerMove || !position || !move) return;
    event.stopPropagation();
    drag.current = { x: event.clientX, y: event.clientY, origin: position };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const update = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current) {
      if (
        !movedBeyondLongPressTolerance(press.current, {
          x: event.clientX,
          y: event.clientY,
        })
      ) {
        return;
      }
      moved.current = true;
      clearPress();
    }
    if (longPressed.current || !drag.current || !move) return;
    const parent = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!parent) return;
    event.currentTarget.classList.add("dragging");
    if (isCompactDesktopViewport()) {
      const scrollTop = event.currentTarget.parentElement?.scrollTop ?? 0;
      move(id, {
        x: event.clientX - parent.left,
        y: event.clientY - parent.top + scrollTop,
      });
      return;
    }
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    move(id, {
      x: clamp(drag.current.origin.x + dx, 0, Math.max(0, parent.width - 78)),
      y: clamp(drag.current.origin.y + dy, 0, Math.max(0, parent.height - 86)),
    });
  };
  const end = (event: ReactPointerEvent<HTMLButtonElement>) => {
    clearPress();
    event.currentTarget.classList.remove("dragging");
    if (!drag.current) return;
    const dropped = moved.current && !isCompactDesktopViewport();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dropped) onPointerDrop?.(event.clientX, event.clientY);
  };
  const contextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isCompactDesktopViewport()) {
      const x = press.current?.x ?? event.clientX;
      const y = press.current?.y ?? event.clientY;
      triggerContextMenu(x, y);
    } else {
      onLongPress(event.clientX, event.clientY);
    }
  };
  const clickAction = (desktopAction: "ignore" | "select") => {
    const action = desktopIconClickAction(
      isCompactDesktopViewport(),
      longPressed.current,
      moved.current,
      desktopAction,
    );
    longPressed.current = false;
    return action;
  };
  useEffect(() => clearPress, []);
  return { moved, start, update, end, contextMenu, clickAction };
}

type DesktopShortcutProps = {
  id: string;
  label: string;
  icon: string;
  kind: string;
  position: IconPosition;
  order: number;
  move: (id: string, position: IconPosition) => void;
  open: () => void;
  onContextMenu: (x: number, y: number) => void;
};

export function DesktopShortcut({
  id,
  label,
  icon,
  kind,
  position,
  order,
  move,
  open,
  onContextMenu,
}: DesktopShortcutProps) {
  const interaction = useDesktopIconInteraction(id, position, move, onContextMenu);
  return (
    <button
      data-desktop-icon-id={id}
      className="desktop-shortcut positioned"
      style={{ left: position.x, top: position.y, order }}
      onPointerDown={interaction.start}
      onPointerMove={interaction.update}
      onPointerUp={interaction.end}
      onPointerCancel={interaction.end}
      onClick={(event) => {
        event.stopPropagation();
        if (interaction.clickAction("ignore") === "open") open();
      }}
      onDoubleClick={() => {
        if (!isCompactDesktopViewport() && !interaction.moved.current) open();
      }}
      onContextMenu={interaction.contextMenu}
      onKeyDown={(event) => {
        if (event.key === "Enter") open();
      }}
    >
      <span className={`shortcut-icon ${kind}-shortcut`}>{icon}</span>
      <strong>{label}</strong>
    </button>
  );
}

type DesktopFileProps = {
  item: DesktopItem;
  position?: IconPosition;
  order: number;
  move?: (id: string, position: IconPosition) => void;
  selected: boolean;
  cut?: boolean;
  onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onOpen: () => void;
  onPointerDrop?: (x: number, y: number) => void;
  onFileDrop?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onContextMenu?: (x: number, y: number) => void;
};

export function DesktopFile({
  item,
  position,
  order,
  move,
  selected,
  cut = false,
  onSelect,
  onPointerStart,
  onOpen,
  onPointerDrop,
  onFileDrop,
  onContextMenu,
}: DesktopFileProps) {
  const interaction = useDesktopIconInteraction(
    item.id,
    position,
    move,
    (x, y) => onContextMenu?.(x, y),
    onPointerDrop,
  );
  return (
    <button
      data-desktop-icon-id={item.id}
      data-desktop-folder-id={item.type === "folder" ? item.id : undefined}
      className={`desktop-item ${position ? "positioned" : ""} ${selected ? "selected" : ""} ${cut ? "cut" : ""}`}
      style={position ? { left: position.x, top: position.y, order } : undefined}
      onPointerDown={(event) => {
        onPointerStart?.(event);
        interaction.start(event);
      }}
      onPointerMove={interaction.update}
      onPointerUp={interaction.end}
      onPointerCancel={interaction.end}
      onDragOver={(event) => {
        if (!onFileDrop || !hasDesktopFileDrag(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.add("drop-target");
      }}
      onDragLeave={(event) => event.currentTarget.classList.remove("drop-target")}
      onDrop={(event) => {
        event.currentTarget.classList.remove("drop-target");
        onFileDrop?.(event);
      }}
      onClick={(event) => {
        event.stopPropagation();
        const action = interaction.clickAction("select");
        if (action === "open") onOpen();
        else if (action === "select") onSelect(event);
      }}
      onContextMenu={interaction.contextMenu}
      onDoubleClick={() => {
        if (!isCompactDesktopViewport() && !interaction.moved.current) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
        if (event.shiftKey && event.key === "F10" && onContextMenu) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onContextMenu(rect.left + 20, rect.top + 20);
        }
      }}
    >
      {item.type === "folder" ? (
        <span className="folder-icon">
          <i />
        </span>
      ) : item.type === "text" ? (
        <span className="text-icon">
          <b>TXT</b>
          <i />
          <i />
          <i />
        </span>
      ) : (
        <span className="image-icon" style={{ backgroundImage: `url(${item.content})` }} />
      )}
      <strong>{item.name}</strong>
    </button>
  );
}
