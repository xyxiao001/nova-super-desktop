"use client";

import type {
  FileConflictStrategy,
  FileOperationConflict,
  FileOperationMode,
} from "../../app/desktopFiles";
import PwaManager from "../../app/PwaManager";

export type PendingFileOperation = {
  mode: FileOperationMode;
  ids: string[];
  parentId: string | null;
  conflicts: FileOperationConflict[];
};

type DesktopOverlaysProps = {
  renameItemId: string | null;
  renameValue: string;
  pendingFileOperation: PendingFileOperation | null;
  draggingFiles: boolean;
  toast: string;
  booting: boolean;
  onRenameValueChange: (value: string) => void;
  onCancelRename: () => void;
  onFinishRename: () => void;
  onCancelFileOperation: () => void;
  onPerformFileOperation: (
    mode: FileOperationMode,
    ids: string[],
    parentId: string | null,
    strategy: FileConflictStrategy,
  ) => void;
};

export default function DesktopOverlays({
  renameItemId,
  renameValue,
  pendingFileOperation,
  draggingFiles,
  toast,
  booting,
  onRenameValueChange,
  onCancelRename,
  onFinishRename,
  onCancelFileOperation,
  onPerformFileOperation,
}: DesktopOverlaysProps) {
  return (
    <>
      {renameItemId && (
        <div className="rename-layer">
          <form
            className="rename-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              onFinishRename();
            }}
          >
            <strong>重命名</strong>
            <input
              autoFocus
              value={renameValue}
              onChange={(event) => onRenameValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") onCancelRename();
              }}
            />
            <div>
              <button type="button" onClick={onCancelRename}>
                取消
              </button>
              <button type="submit">确定</button>
            </div>
          </form>
        </div>
      )}
      {pendingFileOperation && (
        <div className="file-operation-layer">
          <section
            className="file-operation-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="文件名称冲突"
          >
            <header>
              <span>!</span>
              <div>
                <strong>目标位置已有同名项目</strong>
                <p>{pendingFileOperation.conflicts.length} 个项目需要处理</p>
              </div>
            </header>
            <div className="file-conflict-list">
              {pendingFileOperation.conflicts.slice(0, 3).map((conflict) => (
                <div key={`${conflict.sourceId}:${conflict.targetId}`}>
                  <span>{conflict.sourceName}</span>
                  <small>将与现有项目发生冲突</small>
                </div>
              ))}
              {pendingFileOperation.conflicts.length > 3 && (
                <p>另有 {pendingFileOperation.conflicts.length - 3} 个项目</p>
              )}
            </div>
            <footer>
              <button onClick={onCancelFileOperation}>取消</button>
              <button
                onClick={() =>
                  onPerformFileOperation(
                    pendingFileOperation.mode,
                    pendingFileOperation.ids,
                    pendingFileOperation.parentId,
                    "keep-both",
                  )
                }
              >
                保留两份
              </button>
              <button
                className="danger"
                onClick={() =>
                  onPerformFileOperation(
                    pendingFileOperation.mode,
                    pendingFileOperation.ids,
                    pendingFileOperation.parentId,
                    "replace",
                  )
                }
              >
                替换
              </button>
            </footer>
          </section>
        </div>
      )}
      {draggingFiles && (
        <div className="desktop-drop-zone">
          <div>
            <span>⇩</span>
            <strong>释放以上传到桌面</strong>
            <small>支持图片和 TXT 文本</small>
          </div>
        </div>
      )}
      <PwaManager />
      {toast && (
        <div className="desktop-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      {booting && (
        <div className="boot-screen">
          <div className="boot-logo">
            <i />
            <i />
            <i />
            <i />
          </div>
          <strong>NOVA</strong>
          <span>正在启动超级桌面</span>
          <div className="boot-dots">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
    </>
  );
}
