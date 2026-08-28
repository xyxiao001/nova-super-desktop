# ADR-0004：桌面文件使用元数据仓库与 Blob 内容仓库

- 状态：已接受
- 日期：2026-08-28
- 关联 Spec：`docs/specs/SPEC-20260828-p2-desktop-blob-storage.md`

## 决策

`nova-desktop` 使用 `items` 保存可索引元数据，使用 `contents` 以文件 ID 保存 Blob。目录读取走 `parentKey` 索引，文件内容按 ID 读取；对应用和备份仍装配为完整 `DesktopItem`。

## 原因

目录列表不需要读取大内容，且移动、重命名、回收站状态变化不应重写图片或长文本。保持逻辑 `DesktopItem` 可限制本次迁移对应用组件的影响。

## 代价与限制

- 当前桌面工作区仍需要完整文件图谱以支持跨目录文件操作，但读取路径已拆成目录与文件 API；
- IndexedDB 升级需要一次性把旧内联内容迁移为 Blob；
- 备份边界继续使用字符串内容，不直接暴露 Blob。
