import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../../app/desktopFiles";
import {
  clampPhotoZoom,
  createPhotoLibrary,
  FEATURED_PHOTOS,
  photoZoomFromPinch,
} from "../../src/apps/viewer/photoLibrary";

const desktopPhoto = (id: string, createdAt: number): DesktopItem => ({
  id,
  type: "image",
  name: `${id}.jpg`,
  content: `data:image/jpeg;base64,${id}`,
  parentId: null,
  createdAt,
});

describe("photoLibrary", () => {
  it("keeps featured photos static and sorts desktop photos by creation time", () => {
    const library = createPhotoLibrary([
      desktopPhoto("older", 1),
      { ...desktopPhoto("text", 3), type: "text", content: "not an image" },
      desktopPhoto("newer", 2),
    ]);

    expect(library.slice(0, FEATURED_PHOTOS.length)).toEqual(FEATURED_PHOTOS);
    expect(library.slice(FEATURED_PHOTOS.length).map((photo) => photo.id)).toEqual([
      "desktop:newer",
      "desktop:older",
    ]);
  });

  it("limits zoom to quarter steps between 25% and 400%", () => {
    expect(clampPhotoZoom(0)).toBe(0.25);
    expect(clampPhotoZoom(1.12)).toBe(1);
    expect(clampPhotoZoom(1.13)).toBe(1.25);
    expect(clampPhotoZoom(8)).toBe(4);
  });

  it("scales a photo with the distance between two pointers", () => {
    expect(photoZoomFromPinch(1, 100, 175)).toBe(1.75);
    expect(photoZoomFromPinch(3, 100, 200)).toBe(4);
    expect(photoZoomFromPinch(1, 100, 10)).toBe(0.25);
  });
});
