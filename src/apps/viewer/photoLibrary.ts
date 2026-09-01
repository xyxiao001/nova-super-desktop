import type { DesktopItem } from "../../../app/desktopFiles";

export type PhotoAsset = {
  id: string;
  name: string;
  src: string;
  thumbnail: string;
  source: "featured" | "desktop";
  width?: number;
  height?: number;
  desktopItem?: DesktopItem;
};

export const FEATURED_PHOTOS: PhotoAsset[] = [
  {
    id: "featured:harbor-sunset",
    name: "暮色港湾",
    src: "/photos/pexels-29318864.jpg",
    thumbnail: "/photos/pexels-29318864-thumb.jpg",
    source: "featured",
    width: 2400,
    height: 1600,
  },
  {
    id: "featured:blue-atoll",
    name: "云下环礁",
    src: "/photos/pexels-9149367.jpg",
    thumbnail: "/photos/pexels-9149367-thumb.jpg",
    source: "featured",
    width: 2400,
    height: 1600,
  },
  {
    id: "featured:white-cove",
    name: "白沙浅湾",
    src: "/photos/pexels-28843913.jpg",
    thumbnail: "/photos/pexels-28843913-thumb.jpg",
    source: "featured",
    width: 2400,
    height: 1599,
  },
  {
    id: "featured:ocean-pier",
    name: "海上栈桥",
    src: "/photos/pexels-7079773.jpg",
    thumbnail: "/photos/pexels-7079773-thumb.jpg",
    source: "featured",
    width: 1350,
    height: 2400,
  },
];

export const createPhotoLibrary = (images: DesktopItem[]): PhotoAsset[] => [
  ...FEATURED_PHOTOS,
  ...images
    .filter((item) => item.type === "image")
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((item) => ({
      id: `desktop:${item.id}`,
      name: item.name,
      src: item.content,
      thumbnail: item.content,
      source: "desktop" as const,
      desktopItem: item,
    })),
];

export const clampPhotoZoom = (zoom: number) => (
  Math.min(4, Math.max(0.25, Math.round(zoom * 4) / 4))
);

export const photoZoomFromPinch = (zoom: number, startDistance: number, distance: number) => (
  Math.min(4, Math.max(0.25, zoom * distance / startDistance))
);
