export const COMPACT_DESKTOP_QUERY = "(max-width: 680px), (max-width: 932px) and (pointer: coarse)";
export const DESKTOP_ICON_LONG_PRESS_MS = 500;
export const DESKTOP_ICON_MOVE_TOLERANCE = 10;
export const MOBILE_SEARCH_PULL_DISTANCE = 64;

export type PointerPoint = {
  x: number;
  y: number;
};

export function isCompactDesktopViewport() {
  return window.matchMedia(COMPACT_DESKTOP_QUERY).matches;
}

export function movedBeyondLongPressTolerance(
  origin: PointerPoint,
  current: PointerPoint,
) {
  return Math.hypot(current.x - origin.x, current.y - origin.y)
    > DESKTOP_ICON_MOVE_TOLERANCE;
}

export function desktopIconClickAction(
  compact: boolean,
  longPressed: boolean,
  moved: boolean,
  desktopAction: "ignore" | "select",
) {
  if (longPressed || moved) return "ignore" as const;
  return compact ? "open" as const : desktopAction;
}

export function isMobileSearchPull(
  origin: PointerPoint,
  current: PointerPoint,
) {
  const deltaX = current.x - origin.x;
  const deltaY = current.y - origin.y;
  return deltaY >= MOBILE_SEARCH_PULL_DISTANCE
    && deltaY > Math.abs(deltaX) * 1.25;
}
