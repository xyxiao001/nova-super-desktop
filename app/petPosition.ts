export const DESKTOP_PET_WIDTH = 92;
export const DESKTOP_PET_HORIZONTAL_GAP = 2;
export const DESKTOP_PET_HORIZONTAL_INSET = (
  DESKTOP_PET_WIDTH / 2 + DESKTOP_PET_HORIZONTAL_GAP
);

export function clampDesktopPetX(value: number, containerWidth: number) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0.5;
  const inset = Math.min(containerWidth / 2, DESKTOP_PET_HORIZONTAL_INSET);
  const minimum = inset / containerWidth;
  return Math.min(1 - minimum, Math.max(minimum, value));
}
