# SPEC-20260828：P1 应用 Manifest 与 Runtime

- 状态：已完成
- 提出日期：2026-08-28
- 负责人：Codex
- 相关 ADR：`docs/adrs/ADR-0001-app-manifest-runtime.md`
- 相关迭代：`ITER-20260828-p1-app-manifest-01.md`、`ITER-20260828-p1-app-runtime-02.md`

## 背景

应用元数据与动态加载器目前分别维护在 `app/appRegistry.ts` 和 `app/lazyApps.ts`。P0 增加了一致性测试，但新增应用仍需要修改两份源数据。`app/page.tsx` 还为游戏大厅手工拼装全部游戏运行状态并传递启动回调，应用无法通过稳定的桌面运行时读取自己的运行上下文。

## 目标

建立单一 App Manifest 作为应用元数据和加载器的权威来源，并提供最小 App Runtime，使游戏大厅成为首个通过 Runtime 使用窗口运行状态和启动能力的应用，同时保持所有产品行为不变。

## 非目标

- 不消除 `page.tsx` 中所有应用专属 Props；
- 不改变应用 ID、名称、图标、顺序、分组或动态 import 路径；
- 不改变窗口 reducer、文件系统、启动意图、存储或资源缓存；
- 不实现插件系统、目录自动扫描、远程应用或多实例；
- 不新增依赖。

## 方案

### 用户可感知行为

- 无变化。

### 技术设计

1. 新建 `app/appManifest.ts`，在同一声明中保存全部应用的展示字段和动态加载器，并从键集合推导 `WindowAppId`。
2. `app/appRegistry.ts` 改为兼容导出层，从 Manifest 派生现有注册表、launcher 和开始菜单集合。
3. `app/lazyApps.ts` 从 Manifest 派生 loader 映射和现有 Lazy 组件导出。
4. 新建 `app/AppRuntime.tsx`，提供窗口状态、当前焦点、`openApp` 和 `isAppActive`。
5. 桌面外壳提供 Runtime；游戏大厅改为从 Runtime 获取运行状态和启动能力，移除 `running` 与 `onLaunch` Props。

### 数据与状态归属

- Manifest 是静态应用声明，不持久化；
- Runtime 只暴露桌面现有窗口会话状态和命令，不复制状态；
- 是否需要迁移：否。

## 平台影响清单

| 检查项 | 是否涉及 | 说明 |
| --- | --- | --- |
| 应用注册与懒加载 | 是 | 合并为单一权威来源 |
| 窗口生命周期 | 是 | Runtime 只读现有状态并调用现有 open 行为 |
| 文件类型与打开方式 | 否 | |
| 跨应用启动或事件 | 否 | 启动语义不变 |
| localStorage / IndexedDB | 否 | |
| 备份、恢复与清理 | 否 | |
| Service Worker 与资源包 | 否 | 留到 P2 |
| 离线行为 | 否 | |
| 构建与部署 | 否 | |

## 修改范围

### 计划修改

- `app/appManifest.ts`：新增权威应用声明；
- `app/appRegistry.ts`：改为派生兼容层；
- `app/lazyApps.ts`：从 Manifest 派生 loader；
- `app/AppRuntime.tsx`：新增最小运行时；
- `app/page.tsx`：提供 Runtime 并减少游戏大厅手工接线；
- `app/GameHall.tsx`：使用 Runtime；
- 相关单测和本阶段文档。

### 不修改边界

- 保持全部应用元数据、入口顺序和加载时机不变；
- 保持窗口和游戏大厅用户行为不变；
- Runtime 不拥有或复制窗口状态；
- 不新增兜底、自动重试、兼容分支或错误提示；
- 不运行 lint 或完整构建。

## 验收标准

- [x] AC-1：应用展示元数据和动态加载器只在一个 Manifest 中声明；
- [x] AC-2：现有 `APP_REGISTRY`、launcher、开始菜单和 Lazy 导出保持可用；
- [x] AC-3：`WindowAppId` 从 Manifest 键集合推导；
- [x] AC-4：Runtime 暴露窗口状态、焦点、打开应用和 active 判断，不复制状态；
- [x] AC-5：游戏大厅不再接收手工 `running` 和 `onLaunch` Props；
- [x] AC-6：TypeScript 和全部单测通过，应用清单契约测试继续通过。

## 验证计划

- `npx tsc --noEmit`
- Manifest、Runtime 和注册表相关定向单测
- `npm test`
- 不运行 lint、完整构建或浏览器测试

## 风险与迁移

- 风险：Manifest 类型推导或 Context 接线可能改变模块加载；通过 loader 契约测试控制；
- 数据迁移：无；
- 回滚：恢复两个独立清单和游戏大厅原 Props。

## 待确认项

- 无。用户已授权按既定路线自动推进；本 Spec 严格限制为无产品行为变化的内部平台建设。

## 迭代拆分

1. 建立 App Manifest 并派生注册表与 loaders；
2. 建立 App Runtime，并迁移游戏大厅作为首个使用者。

## 后续事项

- P1 Storage Provider；
- P2 从 Manifest 派生资源包；
- 其他应用按实际需要逐步迁移 Runtime，不在本 Spec 批量改造。

## 确认记录

- 2026-08-28：用户授权按 P0→P3 路线自动迭代；本阶段保持产品行为不变。
