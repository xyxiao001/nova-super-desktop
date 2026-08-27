import type { DesktopItem } from "./desktopFiles";

export type FileOpenApp = "explorer" | "notes" | "viewer" | "photo";

export type FileOpenOption = {
  app: FileOpenApp;
  label: string;
  primary: boolean;
};

const FILE_OPEN_OPTIONS: Record<DesktopItem["type"], FileOpenOption[]> = {
  folder: [
    { app: "explorer", label: "文件资源管理器", primary: true },
  ],
  text: [
    { app: "notes", label: "记事本", primary: true },
  ],
  image: [
    { app: "viewer", label: "照片", primary: true },
    { app: "photo", label: "照片实验室", primary: false },
  ],
};

export function fileOpenOptions(type: DesktopItem["type"]) {
  return FILE_OPEN_OPTIONS[type];
}

export function defaultFileOpenApp(type: DesktopItem["type"]) {
  return FILE_OPEN_OPTIONS[type].find((option) => option.primary)!.app;
}
