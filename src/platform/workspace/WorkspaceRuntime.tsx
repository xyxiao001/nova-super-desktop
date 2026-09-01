"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  DesktopItem,
  FileClipboard,
  FileOperationMode,
} from "../../../app/desktopFiles";
import type { FileOpenApp } from "../../../app/fileAssociations";

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
  activeNote: DesktopItem | null;
  noteItems: DesktopItem[];
  activeImage: DesktopItem | null;
  imageItems: DesktopItem[];
  activeFolder: DesktopItem | null;
  folderItems: DesktopItem[];
  activeFolderId: string | null;
  photoEditorSource: WorkspacePhotoSource | null;
  trashedItems: DesktopItem[];
  selectNote: (id: string) => void;
  createText: (parentId?: string | null) => void;
  createFolder: (parentId?: string | null) => void;
  updateItem: (id: string, patch: Partial<DesktopItem>) => void;
  removeNote: (id: string) => void;
  openItem: (item: DesktopItem) => void;
  openItemWith: (item: DesktopItem, app: FileOpenApp) => void;
  openImage: (item: DesktopItem) => void;
  clearActiveImage: () => void;
  editImage: (item: DesktopItem) => void;
  navigateExplorer: (folderId: string | null) => void;
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
  goBackFolder: () => void;
  openItemMenu: (item: DesktopItem, x: number, y: number) => void;
  restoreItems: (ids: string[]) => void;
  permanentlyDeleteItems: (ids: string[]) => void;
  emptyRecycleBin: () => void;
  savePhoto: (name: string, content: string) => void;
  savePhotoEdit: (
    mode: "copy" | "replace",
    name: string,
    content: string,
  ) => void;
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
