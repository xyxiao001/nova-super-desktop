export type WindowGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowSnapMode =
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type WindowShortcutAction = WindowSnapMode | "maximize" | "restore" | "minimize";

export function canMeasureWindowGeometry(
  minimized: boolean,
  maximized: boolean,
  width: number,
  height: number,
) {
  return !minimized && !maximized && width > 0 && height > 0;
}

export function snappedWindowGeometry(
  mode: WindowSnapMode,
  viewportWidth: number,
  viewportHeight: number,
): WindowGeometry {
  const gap = 4;
  const usableWidth = Math.max(640, viewportWidth);
  const usableHeight = Math.max(520, viewportHeight - 53);
  const halfWidth = Math.floor((usableWidth - gap) / 2);
  const halfHeight = Math.floor((usableHeight - gap) / 2);
  const right = usableWidth - halfWidth;
  const bottom = usableHeight - halfHeight;
  const leftSide = mode.endsWith("left") || mode === "left";
  const topSide = mode.startsWith("top");
  const quadrant = mode.includes("-");

  return {
    x: leftSide ? 0 : right,
    y: quadrant && !topSide ? bottom : 0,
    width: halfWidth,
    height: quadrant ? halfHeight : usableHeight,
  };
}

export function windowShortcutAction(
  mode: WindowSnapMode | undefined,
  maximized: boolean,
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
): WindowShortcutAction {
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  if (key === "ArrowUp") {
    if (mode === "left" || mode === "bottom-left") return "top-left";
    if (mode === "right" || mode === "bottom-right") return "top-right";
    return "maximize";
  }
  if (maximized) return "restore";
  if (mode === "left" || mode === "top-left") return "bottom-left";
  if (mode === "right" || mode === "top-right") return "bottom-right";
  return "minimize";
}

export function edgeSnapMode(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
): WindowSnapMode | "maximize" | null {
  const edge = 10;
  const corner = 92;
  const left = x <= edge;
  const right = x >= viewportWidth - edge;
  if (left && y <= corner) return "top-left";
  if (right && y <= corner) return "top-right";
  if (left && y >= viewportHeight - corner) return "bottom-left";
  if (right && y >= viewportHeight - corner) return "bottom-right";
  if (left) return "left";
  if (right) return "right";
  if (y <= edge) return "maximize";
  return null;
}
