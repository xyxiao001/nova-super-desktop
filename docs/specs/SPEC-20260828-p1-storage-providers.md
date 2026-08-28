# SPEC-20260828：P1 统一 Storage Provider

- 状态：已完成
- 提出日期：2026-08-28
- 负责人：Codex
- 相关 ADR：`docs/adrs/ADR-0002-storage-provider-lifecycle.md`
- 相关迭代：`ITER-20260828-p1-storage-registry-01.md`、`ITER-20260828-p1-backup-v2-02.md`、`ITER-20260828-p1-backup-compat-03.md`

## 背景

设置页的数据统计与清理由 `app/novaStorage.ts` 按 localStorage key 前缀和数据库名称集中识别；备份则由 `app/novaBackup.ts` 独立收集桌面 IndexedDB、阅读器 IndexedDB 和 `nova-*` localStorage。两套清单已经不一致：

- 设置页把 `HumanBreak_*` 和 `nova-magic-tower/humanbreak_saves` 归为游戏数据并支持清理；
- 备份只允许 `nova-*` key，且没有导出魔塔 IndexedDB；
- 因此设置页显示的部分游戏数据不会进入备份。

魔塔通过 localForage 使用 IndexedDB 数据库 `nova-magic-tower`、object store `humanbreak_saves`，键和值需要作为同一数据集导出和恢复。

## 目标

建立统一 Storage Provider 注册表，让统计、备份、恢复和清理使用同一组数据所有权声明；新备份完整包含魔塔数据，同时继续支持导入当前版本的 NOVA 备份。

## 非目标

- 不改变任何应用写入数据的时机、key、数据库名或 object store；
- 不把现有 localStorage 游戏数据迁移到 IndexedDB；
- 不改变设置页分类、文案、确认流程或刷新行为；
- 不增加云备份、自动备份、后台任务或远端存储；
- 不修改桌面文件与阅读器的业务存储实现；
- 不新增依赖。

## 当前行为

### 数据分类

- `desktop`：IndexedDB `nova-desktop/items`；
- `reader`：IndexedDB `nova-reader-library/books`；
- `games`：`nova-game-*`、`nova-mines-*`、`HumanBreak_*` 以及魔塔 IndexedDB；
- `reading`：`nova-reader-*`；
- `focus`：`nova-focus-*`；
- `settings`：`nova-settings`、桌面位置和窗口几何；
- `other`：其余 `nova-*` 数据。

### 当前备份版本

版本 1 包含 `desktopItems`、`readerBooks` 和 `localStorage` 三个顶层数据字段。恢复会替换桌面、阅读书籍和全部 `nova-*` localStorage，但不会处理 `HumanBreak_*` 或魔塔 IndexedDB。

## 方案

### 用户可感知行为

- 新导出的备份包含设置页“用户数据”中列出的全部可备份数据，包括魔塔存档；
- 当前版本已经导出的版本 1 备份仍可导入；
- 清除某个设置页分类仍只删除该分类数据；
- 其他应用行为不变。

### 技术设计

#### Storage Provider 契约

建立本地 Provider 注册表，每个 Provider 负责：

- `inspect`：返回条目数和字节估算；
- `exportData`：导出属于该分类的可序列化数据；
- `validateData`：验证备份中的 Provider 数据；
- `restoreData`：清除本分类现有数据并恢复导入数据；
- `clear`：清除本分类数据；
- 分类名称、说明和空分类显示策略。

Provider ID 保持现有 `desktop`、`reader`、`games`、`reading`、`focus`、`settings`、`other`。

#### 备份版本 2

新备份使用版本 2，并以 Provider ID 保存数据：

```ts
type NovaBackupV2 = {
  version: 2;
  exportedAt: string;
  providers: Record<StorageProviderId, unknown>;
};
```

其中 `games` Provider 数据同时包含：

- 属于游戏分类的 localStorage 记录；
- 魔塔 `humanbreak_saves` 中的字符串键和值记录。

#### 版本 1 兼容

`parseNovaBackup` 接受当前版本 1 格式，并将其规范化为内存中的版本 2 Provider 数据：

- `desktopItems` → `desktop`；
- `readerBooks` → `reader`；
- `localStorage` 按现有分类函数拆分到对应 Provider；
- 旧备份没有魔塔 IndexedDB 数据，因此规范化为空记录，不推测或补造存档。

导出只生成版本 2；恢复只消费规范化后的 Provider 数据。

### 数据与状态归属

- Provider 注册表是用户数据生命周期的单一权威来源；
- 各应用继续拥有并写入自己的原存储；
- Provider 只在设置页检查、用户主动备份/恢复或清理时访问数据；
- 是否需要迁移：备份文件格式从 v1 升级到 v2；设备内数据不迁移。

## 平台影响清单

| 检查项 | 是否涉及 | 说明 |
| --- | --- | --- |
| 应用注册与懒加载 | 否 | |
| 窗口生命周期 | 否 | |
| 文件类型与打开方式 | 否 | |
| localStorage / IndexedDB | 是 | 统一生命周期访问，不改变应用写入 |
| 备份、恢复与清理 | 是 | 改为 Provider 驱动并补齐魔塔 |
| Service Worker 与资源包 | 否 | |
| 离线行为 | 否 | |
| 构建与部署 | 否 | |

## 修改范围

### 计划修改

- `app/storageProviders.ts`：新增 Provider 契约、注册表、分类和魔塔存储访问；
- `app/novaStorage.ts`：从 Provider 派生统计和清理；
- `app/novaBackup.ts`：使用 Provider 导出、验证、规范化和恢复；
- `app/SettingsApp.tsx`：仅适配规范化备份类型和汇总结果，不改 UI 流程；
- `tests/unit/storageProviders.test.ts`：Provider 生命周期测试；
- `tests/unit/novaStorage.test.ts`、`tests/unit/novaBackup.test.ts`：更新并补充 v1 兼容、v2 和魔塔覆盖；
- Spec、迭代记录和 ADR。

### 不修改边界

- 不修改任何现有 storage key、数据库名、object store 或应用存取时机；
- 不增加自动迁移、自动重试、后台备份或云端行为；
- 不吞掉 Provider 的存储错误；
- 旧备份只按现有字段确定性映射，不补造缺失数据；
- 不改变设置页分类、文案、确认次数和刷新时机；
- 不运行 lint 或完整构建。

## 验收标准

- [x] AC-1：设置页统计与清理通过同一 Provider 注册表执行；
- [x] AC-2：备份导出与恢复遍历同一 Provider 注册表；
- [x] AC-3：版本 2 备份包含全部 Provider 数据以及魔塔 IndexedDB 键值；
- [x] AC-4：版本 1 备份可以导入并确定性规范化，不补造魔塔数据；
- [x] AC-5：恢复版本 2 后，Provider 管理的数据与备份一致，非 NOVA 数据保持不变；
- [x] AC-6：清理游戏数据同时覆盖游戏 localStorage、`HumanBreak_*` 和魔塔 IndexedDB；
- [x] AC-7：现有设置页分类、清理交互和应用存储写入行为保持不变；
- [x] AC-8：TypeScript 和全部单测通过。

## 验证计划

- Provider、备份和存储定向单测，使用 fake IndexedDB 验证魔塔键值；
- `npx tsc --noEmit`；
- `npm test`；
- 不运行 lint、完整构建或浏览器测试。

## 风险与迁移

- 风险：恢复跨多个 Provider，不具备跨 localStorage 和多个 IndexedDB 的全局事务；保持现有恢复顺序和错误传播，不新增伪原子兜底；
- 备份迁移：解析 v1 后在内存中规范化为 v2，不改写用户原文件；
- 回滚：恢复现有 `novaStorage.ts` 和 v1 备份实现；新导出的 v2 文件在旧代码中不可导入。

## 待确认项

- 无。两轮兼容范围确认均已完成。

## 迭代拆分

1. 建立 Storage Provider 契约并让设置页统计、清理改为 Provider 驱动；
2. 建立 v2 备份并完整导出、恢复 Provider 数据；
3. 增加 v1 兼容规范化和魔塔 IndexedDB 生命周期测试。

## 后续事项

- 游戏进度从 localStorage 迁移到 IndexedDB 不属于本 Spec；
- 全局事务或恢复回滚策略不属于本 Spec。

## 确认记录

- 2026-08-28：用户第一次明确确认接受 v1 备份兼容分支，并使用 v2 备份完整覆盖魔塔 IndexedDB 和 `HumanBreak_*` 数据。
- 2026-08-28：用户第二次明确确认接受最终实施文件范围和不修改边界。
