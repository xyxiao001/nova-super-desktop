"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  DesktopItem,
  FileClipboard,
  FileOperationMode,
} from "../../../app/desktopFiles";
import type { FileOpenApp } from "../../../app/fileAssociations";
import type { WindowInstanceId } from "../windows/windowInstanceState";

export type WorkspacePhotoSource = {
  id?: string;
  name: string;
  content: string;
};

export type WorkspaceRuntimeValue = {
  items: DesktopItem[];
  visibleItems: DesktopItem[];
  clipboard: FileClipboard | null;
  canUndo: boolean;
  photoEditorSource: WorkspacePhotoSource | null;
  trashedItems: DesktopItem[];
  createText: (
    parentId?: string | null,
    sourceInstanceId?: WindowInstanceId,
  ) => void;
  createFolder: (parentId?: string | null) => void;
  updateItem: (id: string, patch: Partial<DesktopItem>) => void;
  removeNote: (id: string) => void;
  openItem: (item: DesktopItem) => void;
  openItemWith: (item: DesktopItem, app: FileOpenApp) => void;
  openFolderWindow: (item: DesktopItem) => void;
  editImage: (item: DesktopItem) => void;
  renameItem: (item: DesktopItem) => void;
  setClipboard: (mode: FileOperationMode, ids: string[]) => void;
  paste: (parentId: string | null) => void;
  performFileOperation: (
    mode: FileOperationMode,
    ids: string[],
    parentId: string | null,
  ) => void;
  trashFromExplorer: (ids: string[]) => void;
  undoFileOperation: () => void;
  openRecycleBin: () => void;
  openItemMenu: (item: DesktopItem, x: number, y: number) => void;
  restoreItems: (ids: string[]) => void;
  permanentlyDeleteItems: (ids: string[]) => void;
  emptyRecycleBin: () => void;
  savePhoto: (name: string, content: string) => void;
  savePhotoEdit: (
    mode: "copy" | "replace",
    name: string,
    content: string,
  ) => boolean;
  createReaderExcerpt: (excerpt: { title: string; content: string }) => void;
};

const WorkspaceRuntimeContext = createContext<WorkspaceRuntimeValue | null>(null);

export function WorkspaceRuntimeProvider({
  value,
  children,
}: {
  value: WorkspaceRuntimeValue;
  children: ReactNode;
}) {
  return (
    <WorkspaceRuntimeContext.Provider value={value}>
      {children}
    </WorkspaceRuntimeContext.Provider>
  );
}

export function useWorkspaceRuntime() {
  return useContext(WorkspaceRuntimeContext)!;
}
