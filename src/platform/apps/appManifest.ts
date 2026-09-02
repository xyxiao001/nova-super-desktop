import type { StorageProvider } from "../storage/providers/types";

export type StartAppGroup = "create" | "productivity" | "system";
export type AppWindowSize = "compact" | "standard" | "wide" | "canvas";

export type AppWindowConfig = {
  size: AppWindowSize;
  minWidth?: number;
  minHeight?: number;
  mobile: "fullscreen";
  initial?: {
    inset?: string;
    width?: string;
    height?: string;
    left?: string;
    top?: string;
  };
  tablet?: {
    inset?: string;
    width?: string;
    left?: string;
    top?: string;
  };
};

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

const SYSTEM_RESOURCE_PACKAGE_MANIFESTS: readonly ResourcePackageManifest[] = [
  { id: "system", label: "NOVA 系统核心", description: "桌面启动所需的最小离线文件", displayOrder: 0 },
  { id: "apps", label: "应用与游戏模块", description: "打开窗口时按需加载的代码、样式与字体", displayOrder: 1, matchPriority: 40, pathPrefixes: ["/_next/static/"], destinations: ["script", "style", "worker", "font"], extensions: ["css", "js", "wasm", "woff", "woff2"] },
  { id: "media", label: "其他界面资源", description: "使用过程中加载的图片与媒体", displayOrder: 7, matchPriority: 50, destinations: ["image", "audio", "video"] },
] as const;

export type AppManifestEntry = {
  label: string;
  icon: string;
  kind: string;
  launcher: boolean;
  taskbarPinned: boolean;
  startPinned?: boolean;
  startGroup?: StartAppGroup;
  windowIcon?: string;
  taskbarIcon?: string;
  resourcePackages?: readonly ResourcePackageManifest[];
  storageProviders?: readonly (() => Promise<{ default: StorageProvider }>)[];
  window: AppWindowConfig;
  load: () => Promise<unknown>;
};

const defineAppManifests = <const T extends Record<string, AppManifestEntry>>(manifests: T) => manifests;

export const APP_MANIFESTS = defineAppManifests({
  photo: { label: "照片实验室", icon: "✦", kind: "photo", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create", window: { size: "canvas", mobile: "fullscreen", initial: { inset: "24px 20px 70px 36px", width: "auto", height: "auto", left: "36px", top: "24px" }, tablet: { inset: "8px 6px 56px", width: "auto", left: "6px", top: "8px" } }, load: () => import("../../apps/photo/entry") },
  explorer: { label: "文件资源管理器", icon: "▰", kind: "explorer", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "productivity", window: { size: "wide", mobile: "fullscreen", initial: { width: "min(1020px,90vw)", height: "min(680px,84vh)", left: "9vw", top: "48px" } }, load: () => import("../../apps/explorer/entry") },
  notes: { label: "记事本", icon: "▤", kind: "notes", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "productivity", window: { size: "wide", mobile: "fullscreen", initial: { width: "min(880px,86vw)", height: "min(620px,82vh)", left: "12vw", top: "54px" } }, load: () => import("../../apps/notes/entry") },
  viewer: { label: "照片", icon: "▧", kind: "viewer", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create", windowIcon: "✿", resourcePackages: [{ id: "photos", label: "相册图片", description: "内置精选照片与缩略图", displayOrder: 2, matchPriority: 30, pathPrefixes: ["/photos/"], exactPaths: ["/default-photo.jpg"] }], window: { size: "wide", mobile: "fullscreen", initial: { width: "min(980px,88vw)", height: "min(650px,84vh)", left: "8vw", top: "42px" } }, load: () => import("../../apps/viewer/entry") },
  reader: { label: "NOVA 阅读", icon: "阅", kind: "reader", launcher: true, taskbarPinned: true, startPinned: true, startGroup: "create", resourcePackages: [{ id: "books", label: "阅读内容", description: "书目与按需下载的正文资源", displayOrder: 3, matchPriority: 20, pathPrefixes: ["/books/"] }], storageProviders: [() => import("../../apps/reader/storageProvider"), () => import("../../apps/reader/readingStorageProvider")], window: { size: "canvas", mobile: "fullscreen", initial: { width: "min(1180px,94vw)", height: "min(760px,88vh)", left: "3vw", top: "32px" }, tablet: { width: "94vw", left: "3vw" } }, load: () => import("../../apps/reader/entry") },
  calendar: { label: "日历", icon: "31", kind: "calendar", launcher: true, taskbarPinned: false, startGroup: "productivity", storageProviders: [() => import("../../apps/calendar/storageProvider")], window: { size: "wide", minWidth: 700, minHeight: 520, mobile: "fullscreen", initial: { width: "min(920px,90vw)", height: "min(650px,84vh)", left: "14vw", top: "48px" } }, load: () => import("../../apps/calendar/entry") },
  games: { label: "游戏大厅", icon: "", kind: "games", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system", storageProviders: [() => import("../../apps/games/storageProvider")], window: { size: "wide", mobile: "fullscreen", initial: { width: "min(900px,90vw)", height: "min(650px,82vh)", left: "15vw", top: "58px" } }, load: () => import("../../apps/games/entry") },
  settings: { label: "设置", icon: "⚙", kind: "settings", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system", storageProviders: [() => import("../../apps/settings/storageProvider")], window: { size: "standard", minWidth: 560, minHeight: 430, mobile: "fullscreen", initial: { width: "min(660px,86vw)", height: "min(510px,76vh)", left: "22vw", top: "82px" } }, load: () => import("../../apps/settings/entry") },
  folder: { label: "文件夹", icon: "▱", kind: "folder", launcher: false, taskbarPinned: false, window: { size: "standard", mobile: "fullscreen", initial: { width: "min(760px,82vw)", height: "min(520px,74vh)", left: "20vw", top: "82px" } }, load: () => import("../../apps/folder/entry") },
  recycle: { label: "回收站", icon: "▥", kind: "recycle", launcher: true, taskbarPinned: false, startPinned: true, startGroup: "system", windowIcon: "▨", taskbarIcon: "▨", window: { size: "standard", mobile: "fullscreen", initial: { width: "min(760px,82vw)", height: "min(520px,74vh)", left: "22vw", top: "76px" } }, load: () => import("../../apps/recycle/entry") },
  mines: { label: "扫雷", icon: "✹", kind: "mines", launcher: false, taskbarPinned: false, window: { size: "wide", minWidth: 520, minHeight: 680, mobile: "fullscreen", initial: { width: "min(860px,90vw)", height: "min(700px,84vh)", left: "12vw", top: "52px" } }, load: () => import("../../apps/mines/entry") },
  chess: { label: "国际象棋", icon: "♞", kind: "chess", launcher: false, taskbarPinned: false, resourcePackages: [{ id: "chess-engine", label: "国际象棋引擎", description: "Stockfish 脚本与计算引擎", displayOrder: 4, matchPriority: 10, pathPrefixes: ["/stockfish/"] }], window: { size: "wide", minWidth: 600, minHeight: 560, mobile: "fullscreen", initial: { width: "min(860px,90vw)", height: "min(720px,86vh)", left: "14vw", top: "42px" } }, load: () => import("../../apps/chess/entry") },
  gomoku: { label: "五子棋", icon: "●", kind: "gomoku", launcher: false, taskbarPinned: false, window: { size: "wide", minWidth: 580, minHeight: 560, mobile: "fullscreen", initial: { width: "min(840px,90vw)", height: "min(720px,86vh)", left: "13vw", top: "44px" } }, load: () => import("../../apps/gomoku/entry") },
  tower: { label: "魔塔", icon: "塔", kind: "tower", launcher: false, taskbarPinned: false, resourcePackages: [{ id: "magic-tower", label: "魔塔完整资源", description: "77 层、剧情、图片、音乐与音效", displayOrder: 5, matchPriority: 0, pathPrefixes: ["/games/magic-tower/"] }], window: { size: "canvas", minWidth: 680, minHeight: 560, mobile: "fullscreen", initial: { width: "min(980px,92vw)", height: "min(720px,88vh)", left: "10vw", top: "40px" } }, load: () => import("../../apps/tower/entry") },
  youtd2: { label: "YouTD 2", icon: "Y2", kind: "youtd2", launcher: false, taskbarPinned: false, resourcePackages: [{ id: "youtd2", label: "YouTD 2 完整资源", description: "防御塔、物品、建造者与 Godot 运行时", displayOrder: 6, matchPriority: 0, pathPrefixes: ["/games/youtd2/"] }], window: { size: "canvas", minWidth: 760, minHeight: 600, mobile: "fullscreen", initial: { width: "min(1180px,94vw)", height: "min(780px,90vh)", left: "3vw", top: "30px" } }, load: () => import("../../apps/youtd2/entry") },
  wolfslot: { label: "童年老虎机", icon: "", kind: "wolfslot", launcher: false, taskbarPinned: false, resourcePackages: [{ id: "wolf-slot", label: "童年老虎机美术", description: "狼月机台背景与游戏素材", displayOrder: 6, matchPriority: 5, pathPrefixes: ["/assets/games/wolf-slot/"] }], window: { size: "canvas", minWidth: 520, minHeight: 660, mobile: "fullscreen", initial: { width: "min(760px,92vw)", height: "min(860px,90vh)", left: "18vw", top: "26px" } }, load: () => import("../../apps/wolfslot/entry") },
  calculator: { label: "计算器", icon: "＋", kind: "calculator", launcher: true, taskbarPinned: false, startGroup: "productivity", window: { size: "compact", minWidth: 350, minHeight: 540, mobile: "fullscreen", initial: { width: "380px", height: "600px", left: "36vw", top: "52px" } }, load: () => import("../../apps/calculator/entry") },
  drawing: { label: "NOVA 画板", icon: "✎", kind: "drawing", launcher: true, taskbarPinned: false, startGroup: "create", window: { size: "canvas", mobile: "fullscreen", initial: { width: "min(960px,90vw)", height: "min(700px,84vh)", left: "10vw", top: "48px" } }, load: () => import("../../apps/drawing/entry") },
  focus: { label: "专注时钟", icon: "◷", kind: "focus", launcher: true, taskbarPinned: false, startGroup: "productivity", storageProviders: [() => import("../../apps/focus/storageProvider")], window: { size: "standard", minWidth: 620, minHeight: 520, mobile: "fullscreen", initial: { width: "min(820px,88vw)", height: "min(600px,80vh)", left: "17vw", top: "66px" } }, load: () => import("../../apps/focus/entry") },
});

export type WindowAppId = keyof typeof APP_MANIFESTS;

export const RESOURCE_PACKAGE_MANIFESTS: readonly ResourcePackageManifest[] = [
  ...SYSTEM_RESOURCE_PACKAGE_MANIFESTS,
  ...Object.values(APP_MANIFESTS).flatMap<ResourcePackageManifest>((app) =>
    "resourcePackages" in app
      ? [...app.resourcePackages] as ResourcePackageManifest[]
      : [],
  ),
].sort((a, b) => a.displayOrder - b.displayOrder);

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
  window: AppWindowConfig;
};
