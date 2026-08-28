import { lazy } from "react";

export const appModuleLoaders = {
  photo: () => import("./PhotoEditorApp"),
  explorer: () => import("./FileExplorer"),
  notes: () => import("./NotepadApp"),
  viewer: () => import("./PhotoViewerApp"),
  reader: () => import("./ReaderApp"),
  games: () => import("./GameHall"),
  settings: () => import("./SettingsApp"),
  folder: () => import("./FolderViewApp"),
  recycle: () => import("./RecycleBinApp"),
  mines: () => import("./MinesweeperGame"),
  chess: () => import("./ChessGame"),
  gomoku: () => import("./GomokuGame"),
  go: () => import("./GoGame"),
  sudoku: () => import("./SudokuGame"),
  voyage: () => import("./StarVoyageGame"),
  calculator: () => import("./CalculatorApp"),
  drawing: () => import("./DrawingApp"),
  focus: () => import("./FocusClockApp"),
} as const;

export type LazyAppId = keyof typeof appModuleLoaders;

export const LazyPhotoEditor = lazy(appModuleLoaders.photo);
export const LazyFileExplorer = lazy(appModuleLoaders.explorer);
export const LazyNotepadApp = lazy(appModuleLoaders.notes);
export const LazyPhotoViewerApp = lazy(appModuleLoaders.viewer);
export const LazyReaderApp = lazy(appModuleLoaders.reader);
export const LazyGameHall = lazy(appModuleLoaders.games);
export const LazySettingsApp = lazy(appModuleLoaders.settings);
export const LazyFolderViewApp = lazy(appModuleLoaders.folder);
export const LazyRecycleBinApp = lazy(appModuleLoaders.recycle);
export const LazyMinesweeperGame = lazy(appModuleLoaders.mines);
export const LazyChessGame = lazy(appModuleLoaders.chess);
export const LazyGomokuGame = lazy(appModuleLoaders.gomoku);
export const LazyGoGame = lazy(appModuleLoaders.go);
export const LazySudokuGame = lazy(appModuleLoaders.sudoku);
export const LazyStarVoyageGame = lazy(appModuleLoaders.voyage);
export const LazyCalculatorApp = lazy(appModuleLoaders.calculator);
export const LazyDrawingApp = lazy(appModuleLoaders.drawing);
export const LazyFocusClockApp = lazy(appModuleLoaders.focus);
