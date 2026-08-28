import type { GameAppId } from "./GameHall";

export type WindowAppId =
  | "photo"
  | "notes"
  | "viewer"
  | "reader"
  | "games"
  | "settings"
  | "explorer"
  | "folder"
  | "recycle"
  | GameAppId
  | "calculator"
  | "drawing"
  | "focus";

export type StartAppGroup = "create" | "productivity" | "system";

export type AppDefinition = {
  id: WindowAppId;
  label: string;
  icon: string;
  kind: string;
  launcher: boolean;
  taskbarPinned: boolean;
  startPinned?: boolean;
  startGroup?: StartAppGroup;
  windowIcon?: string;
  taskbarIcon?: string;
};

export const START_APP_GROUPS: { id: StartAppGroup; label: string }[] = [
  { id: "create", label: "创作与阅读" },
  { id: "productivity", label: "效率工具" },
  { id: "system", label: "系统与娱乐" },
];

export const APP_REGISTRY: Record<WindowAppId, AppDefinition> = {
  photo: { id: "photo", label: "照片实验室", icon: "✦", kind: "photo", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create" },
  explorer: { id: "explorer", label: "文件资源管理器", icon: "▰", kind: "explorer", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "productivity" },
  notes: { id: "notes", label: "记事本", icon: "▤", kind: "notes", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "productivity" },
  viewer: { id: "viewer", label: "照片", icon: "▧", kind: "viewer", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create", windowIcon: "✿" },
  reader: { id: "reader", label: "NOVA 阅读", icon: "阅", kind: "reader", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create" },
  games: { id: "games", label: "游戏大厅", icon: "", kind: "games", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system" },
  settings: { id: "settings", label: "设置", icon: "⚙", kind: "settings", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system" },
  folder: { id: "folder", label: "文件夹", icon: "▱", kind: "folder", launcher: false, taskbarPinned: false },
  recycle: { id: "recycle", label: "回收站", icon: "▥", kind: "recycle", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system", windowIcon: "▨", taskbarIcon: "▨" },
  mines: { id: "mines", label: "扫雷", icon: "✹", kind: "mines", launcher: false, taskbarPinned: false },
  chess: { id: "chess", label: "国际象棋", icon: "♞", kind: "chess", launcher: false, taskbarPinned: false },
  gomoku: { id: "gomoku", label: "五子棋", icon: "●", kind: "gomoku", launcher: false, taskbarPinned: false },
  go: { id: "go", label: "围棋", icon: "◉", kind: "go", launcher: false, taskbarPinned: false },
  sudoku: { id: "sudoku", label: "数独", icon: "九", kind: "sudoku", launcher: false, taskbarPinned: false },
  voyage: { id: "voyage", label: "星港远征", icon: "✧", kind: "voyage", launcher: false, taskbarPinned: false },
  calculator: { id: "calculator", label: "计算器", icon: "＋", kind: "calculator", launcher: true, taskbarPinned: false, startGroup: "productivity" },
  drawing: { id: "drawing", label: "NOVA 画板", icon: "✎", kind: "drawing", launcher: true, taskbarPinned: false, startGroup: "create" },
  focus: { id: "focus", label: "专注时钟", icon: "◷", kind: "focus", launcher: true, taskbarPinned: false, startGroup: "productivity" },
};

export const REGISTERED_APPS = Object.values(APP_REGISTRY);
export const LAUNCHER_APPS = REGISTERED_APPS.filter((app) => app.launcher);
export const START_PINNED_APPS = LAUNCHER_APPS.filter((app) => app.startPinned);
