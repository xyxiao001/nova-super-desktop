import { lazy } from "react";
import { APP_MANIFESTS, type WindowAppId } from "./appManifest";

export const appModuleLoaders = Object.fromEntries(
  Object.entries(APP_MANIFESTS).map(([id, manifest]) => [id, manifest.load]),
) as { [K in WindowAppId]: (typeof APP_MANIFESTS)[K]["load"] };

export type LazyAppId = WindowAppId;

export const LazyPhotoEditor = lazy(APP_MANIFESTS.photo.load);
export const LazyFileExplorer = lazy(APP_MANIFESTS.explorer.load);
export const LazyNotepadApp = lazy(APP_MANIFESTS.notes.load);
export const LazyPhotoViewerApp = lazy(APP_MANIFESTS.viewer.load);
export const LazyReaderApp = lazy(APP_MANIFESTS.reader.load);
export const LazyGameHall = lazy(APP_MANIFESTS.games.load);
export const LazySettingsApp = lazy(APP_MANIFESTS.settings.load);
export const LazyFolderViewApp = lazy(APP_MANIFESTS.folder.load);
export const LazyRecycleBinApp = lazy(APP_MANIFESTS.recycle.load);
export const LazyMinesweeperGame = lazy(APP_MANIFESTS.mines.load);
export const LazyChessGame = lazy(APP_MANIFESTS.chess.load);
export const LazyGomokuGame = lazy(APP_MANIFESTS.gomoku.load);
export const LazyGoGame = lazy(APP_MANIFESTS.go.load);
export const LazySudokuGame = lazy(APP_MANIFESTS.sudoku.load);
export const LazyStarVoyageGame = lazy(APP_MANIFESTS.voyage.load);
export const LazyMagicTowerGame = lazy(APP_MANIFESTS.tower.load);
export const LazyCalculatorApp = lazy(APP_MANIFESTS.calculator.load);
export const LazyDrawingApp = lazy(APP_MANIFESTS.drawing.load);
export const LazyFocusClockApp = lazy(APP_MANIFESTS.focus.load);
