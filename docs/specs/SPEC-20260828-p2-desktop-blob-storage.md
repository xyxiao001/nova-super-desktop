# SPEC-20260828：P2 桌面文件元数据与 Blob 分离

- 状态：已完成
- 提出日期：2026-08-28
- 负责人：Codex
- 相关 ADR：`docs/adrs/ADR-0004-desktop-metadata-blob-storage.md`

## 背景

`nova-desktop` 当前把文件名、目录关系和完整文本/图片内容放在同一 `items` 记录中，并在启动时一次读取。内容增长后，重命名或移动也会重写大字段，存储层无法按目录或单文件读取。

## 目标

将元数据与文件内容拆到独立对象仓库，内容以 Blob 保存；提供按目录读取元数据和按文件读取内容的 API，并让桌面通过这些 API 装配现有工作区，保持产品行为和备份逻辑格式不变。

## 非目标

- 不改变 `DesktopItem` 对应用层暴露的逻辑结构；
- 不改变桌面、文件夹、记事本、照片、回收站的交互；
- 不改变 v1/v2 备份 JSON 结构；
- 不实现流式预览、分块上传、远端文件或文件系统权限 API；
- 不增加兜底、重试或静默数据修复。

## 方案

1. `nova-desktop` 升级到 v2：`items` 只存元数据和目录索引，`contents` 以文件 ID 保存 Blob。
2. 数据库升级事务把 v1 `items.content` 原样迁移为 Blob，并从元数据记录移除内容。
3. 提供 `loadDesktopDirectory(parentId)` 和 `loadDesktopFile(id)`；桌面工作区按目录遍历元数据、按文件读取内容。
4. 增量同步分别比较元数据与内容：移动/重命名只写元数据，编辑内容只写 Blob；删除同时删除两类记录。
5. Storage Provider 继续导出/恢复完整 `DesktopItem[]`，保持备份协议不变。

## 修改范围

- `app/desktopStorage.ts`、`app/page.tsx`；
- 桌面存储、Provider 与备份相关测试；
- 本阶段 Spec、ADR 和迭代记录。

## 不修改边界

- 保持文件内容字节对应的字符串值、文件 ID 和目录关系不变；
- 保持现有 localStorage 一次性迁移行为；
- 不修改应用组件和文件操作算法；
- 不运行 lint 或完整构建。

## 验收标准

- [x] AC-1：IndexedDB 的 `items` 记录不含 `content`，`contents` 值为 Blob；
- [x] AC-2：v1 IndexedDB 和旧 localStorage 文件均可迁移且内容不变；
- [x] AC-3：目录查询只返回直属元数据，文件查询返回单个完整文件；
- [x] AC-4：元数据变更与内容变更写入各自仓库，删除覆盖两者；
- [x] AC-5：备份导出/恢复格式与行为保持一致；
- [x] AC-6：TypeScript 与全部单测通过。

## 验证计划

- 存储结构、迁移、目录/文件查询、增量写入定向单测；
- Storage Provider 与备份定向单测；
- `npx tsc --noEmit`、`npm test`、`git diff --check`；
- 不运行 lint 或完整构建。

## 确认记录

- 2026-08-28：用户授权按既定 P2 路线自动迭代；本阶段仅改变内部持久化结构。
