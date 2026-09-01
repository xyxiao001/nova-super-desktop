import type { DesktopItem } from "../../../../app/desktopFiles";
import {
  deleteDesktopItems,
  loadDesktopItems,
  replaceDesktopItems,
} from "../../../../app/desktopStorage";
import { encodedSize, type StorageProvider } from "./types";

const isDesktopItem = (value: unknown): value is DesktopItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DesktopItem>;
  return (
    typeof item.id === "string"
    && ["folder", "text", "image"].includes(item.type ?? "")
    && typeof item.name === "string"
    && typeof item.content === "string"
    && (item.parentId === null || typeof item.parentId === "string")
    && typeof item.createdAt === "number"
  );
};

const desktopProvider: StorageProvider = {
  id: "desktop",
  label: "桌面文件",
  displayOrder: 0,
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 个项目，包含回收站内容`,
  inspect: async () => {
    const items = await loadDesktopItems();
    return { entries: items.length, bytes: items.length ? encodedSize(items) : 0 };
  },
  exportData: () => loadDesktopItems(),
  validateData: (data) => Array.isArray(data) && data.every(isDesktopItem),
  restoreData: async (data) => {
    if (!Array.isArray(data) || !data.every(isDesktopItem)) {
      throw new Error("Invalid desktop backup data");
    }
    await replaceDesktopItems(data);
  },
  clear: async () => {
    const items = await loadDesktopItems();
    await deleteDesktopItems(items.map((item) => item.id));
  },
};

export default desktopProvider;
