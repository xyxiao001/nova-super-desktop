export type StartAppGroup = "create" | "productivity" | "system";

export type ResourcePackageManifest = {
  id: string;
  label: string;
  description: string;
  displayOrder: number;
  matchPriority?: number;
  pathPrefixes?: readonly string[];
  exactPaths?: readonly string[];
  destinations?: readonly string[];
  extensions?: readonly string[];
};

export const RESOURCE_PACKAGE_MANIFESTS: readonly ResourcePackageManifest[] = [
  { id: "system", label: "NOVA 系统核心", description: "桌面启动所需的最小离线文件", displayOrder: 0 },
  { id: "apps", label: "应用与游戏模块", description: "打开窗口时按需加载的代码、样式与字体", displayOrder: 1, matchPriority: 40, pathPrefixes: ["/_next/static/"], destinations: ["script", "style", "worker", "font"], extensions: ["css", "js", "wasm", "woff", "woff2"] },
  { id: "photos", label: "相册图片", description: "内置精选照片与缩略图", displayOrder: 2, matchPriority: 30, pathPrefixes: ["/photos/"], exactPaths: ["/default-photo.jpg"] },
  { id: "books", label: "阅读内容", description: "书目与按需下载的正文资源", displayOrder: 3, matchPriority: 20, pathPrefixes: ["/books/"] },
  { id: "chess-engine", label: "国际象棋引擎", description: "Stockfish 脚本与计算引擎", displayOrder: 4, matchPriority: 10, pathPrefixes: ["/stockfish/"] },
  { id: "magic-tower", label: "魔塔完整资源", description: "77 层、剧情、图片、音乐与音效", displayOrder: 5, matchPriority: 0, pathPrefixes: ["/games/magic-tower/"] },
  { id: "media", label: "其他界面资源", description: "使用过程中加载的图片与媒体", displayOrder: 6, matchPriority: 50, destinations: ["image", "audio", "video"] },
] as const;

type AppManifestEntry = {
  label: string;
  icon: string;
  kind: string;
  launcher: boolean;
  taskbarPinned: boolean;
  startPinned?: boolean;
  startGroup?: StartAppGroup;
  windowIcon?: string;
  taskbarIcon?: string;
  resourcePackageIds?: readonly string[];
  load: () => Promise<unknown>;
};

const defineAppManifests = <const T extends Record<string, AppManifestEntry>>(manifests: T) => manifests;

export const APP_MANIFESTS = defineAppManifests({
  photo: { label: "照片实验室", icon: "✦", kind: "photo", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create", load: () => import("./PhotoEditorApp") },
  explorer: { label: "文件资源管理器", icon: "▰", kind: "explorer", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "productivity", load: () => import("./FileExplorer") },
  notes: { label: "记事本", icon: "▤", kind: "notes", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "productivity", load: () => import("./NotepadApp") },
  viewer: { label: "照片", icon: "▧", kind: "viewer", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create", windowIcon: "✿", resourcePackageIds: ["photos"], load: () => import("./PhotoViewerApp") },
  reader: { label: "NOVA 阅读", icon: "阅", kind: "reader", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create", resourcePackageIds: ["books"], load: () => import("./ReaderApp") },
  games: { label: "游戏大厅", icon: "", kind: "games", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system", load: () => import("./GameHall") },
  settings: { label: "设置", icon: "⚙", kind: "settings", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system", load: () => import("./SettingsApp") },
  folder: { label: "文件夹", icon: "▱", kind: "folder", launcher: false, taskbarPinned: false, load: () => import("./FolderViewApp") },
  recycle: { label: "回收站", icon: "▥", kind: "recycle", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system", windowIcon: "▨", taskbarIcon: "▨", load: () => import("./RecycleBinApp") },
  mines: { label: "扫雷", icon: "✹", kind: "mines", launcher: false, taskbarPinned: false, load: () => import("./MinesweeperGame") },
  chess: { label: "国际象棋", icon: "♞", kind: "chess", launcher: false, taskbarPinned: false, resourcePackageIds: ["chess-engine"], load: () => import("./ChessGame") },
  gomoku: { label: "五子棋", icon: "●", kind: "gomoku", launcher: false, taskbarPinned: false, load: () => import("./GomokuGame") },
  go: { label: "围棋", icon: "◉", kind: "go", launcher: false, taskbarPinned: false, load: () => import("./GoGame") },
  sudoku: { label: "数独", icon: "九", kind: "sudoku", launcher: false, taskbarPinned: false, load: () => import("./SudokuGame") },
  voyage: { label: "星港远征", icon: "✧", kind: "voyage", launcher: false, taskbarPinned: false, load: () => import("./StarVoyageGame") },
  tower: { label: "魔塔", icon: "塔", kind: "tower", launcher: false, taskbarPinned: false, resourcePackageIds: ["magic-tower"], load: () => import("./MagicTowerGame") },
  calculator: { label: "计算器", icon: "＋", kind: "calculator", launcher: true, taskbarPinned: false, startGroup: "productivity", load: () => import("./CalculatorApp") },
  drawing: { label: "NOVA 画板", icon: "✎", kind: "drawing", launcher: true, taskbarPinned: false, startGroup: "create", load: () => import("./DrawingApp") },
  focus: { label: "专注时钟", icon: "◷", kind: "focus", launcher: true, taskbarPinned: false, startGroup: "productivity", load: () => import("./FocusClockApp") },
});

export type WindowAppId = keyof typeof APP_MANIFESTS;

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
  resourcePackageIds?: readonly string[];
};
