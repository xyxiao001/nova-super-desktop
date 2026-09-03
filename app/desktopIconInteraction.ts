export const COMPACT_DESKTOP_QUERY = "(max-width: 680px), (max-width: 932px) and (pointer: coarse)";
export const DESKTOP_ICON_LONG_PRESS_MS = 500;
export const DESKTOP_ICON_MOVE_TOLERANCE = 10;
export const MOBILE_SEARCH_PULL_DISTANCE = 64;
const DESKTOP_FOCUS_BLOCKING_SELECTOR = [
  ".desktop-window",
  ".windows-taskbar",
  ".start-menu",
  ".taskbar-window-menu",
  ".system-panel",
  ".desktop-menu",
  ".desktop-pet-layer",
  ".rename-dialog",
  ".file-operation-dialog",
  ".window-switcher",
].join(",");

export type PointerPoint = {
  x: number;
  y: number;
};

export function isCompactDesktopViewport() {
  return window.matchMedia(COMPACT_DESKTOP_QUERY).matches;
}

export function shouldFocusDesktopFromTarget(
  target: { closest: (selectors: string) => Element | null },
) {
  return !target.closest(DESKTOP_FOCUS_BLOCKING_SELECTOR);
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

export function reorderDesktopIconIds(ids: string[], sourceId: string, targetId: string) {
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ids;
  const next = [...ids];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}
