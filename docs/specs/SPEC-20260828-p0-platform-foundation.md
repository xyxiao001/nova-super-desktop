# SPEC-20260828：P0 平台基础建设

- 状态：已完成
- 提出日期：2026-08-28
- 负责人：Codex
- 相关 ADR：无
- 相关迭代：`ITER-20260828-p0-test-entry-01.md`、`ITER-20260828-p0-registry-contract-02.md`、`ITER-20260828-p0-window-reducer-03.md`

## 背景

当前仓库的 TypeScript 检查和 22 个单元测试文件能够通过，但默认测试入口仍执行完整构建，并在构建后运行一组已经过期的 starter 骨架测试。`tests/rendered-html.test.mjs` 仍要求 `_sites-preview`、`SkeletonPreview` 和 starter metadata，而当前产品已经不存在这些内容。因此 `npm test` 不能代表当前 NOVA 的有效测试入口。

应用展示清单位于 `app/appRegistry.ts`，动态加载清单位于 `app/lazyApps.ts`，游戏清单位于 `app/GameHall.tsx`。现有测试分别检查固定列表，但没有直接验证三者的一致性，新增应用或游戏时仍可能漏接。

窗口状态、焦点和 z-index 目前由 `app/page.tsx` 中的多个 `useState`、`useRef` 和回调共同维护。后续 App Manifest 和 App Runtime 建设需要一个可单测的窗口状态边界，因此先抽取纯 reducer，但保持现有单实例窗口行为和所有界面交互不变。

## 目标

建立可信的默认测试入口、应用清单一致性保护和可独立测试的窗口 reducer，为后续 App Manifest 与 App Runtime 建设提供不改变用户行为的基础。

## 非目标

- 本次不建立 App Manifest 或 App Runtime；
- 本次不改变应用注册字段、游戏目录内容或懒加载方式；
- 本次不实现多窗口实例；
- 本次不调整应用 Props、启动意图、文件系统、存储、备份、资源缓存或 CSS；
- 本次不重构桌面菜单、任务栏、快捷键和窗口组件 UI；
- 本次不新增依赖。

## 当前行为

### 测试入口

- `npm run test:unit` 直接运行 Vitest 单元测试；
- `npm test` 先运行 `npm run build`，再运行 `tests/rendered-html.test.mjs`；
- rendered HTML 测试仍验证已删除的 starter loading skeleton；
- 完整构建仍由 `npm run build` 和 `npm run build:vercel` 独立提供。

### 应用清单

- `APP_REGISTRY` 定义所有窗口应用；
- `appModuleLoaders` 定义所有动态加载模块；
- `GAME_CATALOG` 定义游戏大厅内容；
- 三个清单需要开发者手工保持一致。

### 窗口状态

- 每个 `WindowAppId` 只有一个 `WindowState`；
- 打开和聚焦会提升 z-index；
- 关闭或最小化后焦点切换到当前最上层可见窗口，否则回到桌面；
- 最大化与贴靠互斥；
- 刷新桌面时所有窗口保持关闭；
- 窗口几何仍由 `AppWindow` 和 localStorage 独立管理。

## 方案

### 用户可感知行为

- 桌面、应用、游戏和窗口交互保持不变；
- 开发者执行 `npm test` 时得到当前 Vitest 测试结果，不再隐式执行完整构建或过期 starter 测试；
- 完整构建仍通过现有独立命令执行。

### 技术设计

#### 1. 修正测试入口

- 将 `npm test` 调整为执行现有单元测试入口；
- 保留 `test:unit`、`build` 和 `build:vercel` 命令；
- 删除只验证 starter loading skeleton 的 `tests/rendered-html.test.mjs`；
- 不新增新的构建型测试入口。

#### 2. 增加应用清单一致性测试

在现有单测中直接验证：

- `APP_REGISTRY` 与 `appModuleLoaders` 的应用 ID 集合完全相同；
- `GAME_CATALOG` 中的每个游戏都存在于应用注册表；
- 游戏目录项保持非 launcher 窗口，游戏大厅保持 launcher；
- 不继续通过手写完整 ID 快照作为唯一的一致性依据。

#### 3. 抽取窗口 reducer

新增纯 TypeScript 窗口状态模块，集中定义：

- `WindowState`、`WindowStateMap` 和桌面/应用焦点类型；
- 初始窗口状态；
- 打开、聚焦、关闭、静默移除、最小化、最大化切换、贴靠和取消贴靠动作；
- 最上层可见窗口选择逻辑；
- reducer 自己维护递增 z-index，不再由 React ref 维护。

`app/page.tsx` 改为使用 reducer。声音、菜单关闭、任务栏状态、照片来源清理等 UI 副作用仍留在页面回调中，不进入 reducer。

### 数据与状态归属

- 数据所有者：桌面窗口 reducer；
- 状态生命周期：当前页面会话；刷新后重新创建全部关闭的初始状态；
- 持久化位置：窗口 open/minimized/maximized/z 状态不持久化；窗口几何继续使用现有 localStorage；
- 是否需要迁移：否。

## 平台影响清单

| 检查项 | 是否涉及 | 说明 |
| --- | --- | --- |
| 应用注册与懒加载 | 是 | 只增加一致性测试，不修改清单内容 |
| 窗口生命周期 | 是 | 状态实现迁移到 reducer，现有行为保持不变 |
| 文件类型与打开方式 | 否 | |
| 跨应用启动或事件 | 否 | 启动意图保持现状 |
| localStorage / IndexedDB | 否 | 窗口几何存储保持现状 |
| 备份、恢复与清理 | 否 | |
| Service Worker 与资源包 | 否 | |
| Worker / iframe | 否 | |
| 离线行为 | 否 | |
| 构建与部署 | 是 | 只调整默认测试脚本，不修改两条构建命令 |

## 修改范围

### 计划修改

- `package.json`：修正默认测试入口；
- `tests/rendered-html.test.mjs`：删除过期 starter 骨架测试；
- `tests/unit/appRegistry.test.ts`：增加跨清单一致性验证；
- `tests/unit/lazyApps.test.ts`：移除依赖固定完整 ID 列表的重复断言，保留 loader 能力验证；
- `app/windowState.ts`：新增纯窗口 reducer、动作和 selector；
- `tests/unit/windowState.test.ts`：验证窗口状态转换；
- `app/page.tsx`：接入窗口 reducer，移除重复窗口状态实现；
- `docs/iterations/`：记录三个单目标迭代；
- 本 Spec：更新状态、验收结果和后续事项。

### 不修改边界

- 不修改任何应用或游戏的可见名称、图标、顺序和入口；
- 不修改应用模块的动态 import 路径和加载时机；
- 不修改窗口打开、关闭、最小化、最大化、贴靠、焦点和 Alt+Tab 的用户行为；
- 不修改窗口几何的 localStorage key、读写时机和数据结构；
- 不修改启动意图和应用 Props；
- 不新增兜底、自动重试、兼容分支或错误提示；
- 不运行 lint 或完整构建。

## 验收标准

- [x] AC-1：执行 `npm test` 时直接运行当前 Vitest 测试，不隐式执行完整构建，也不运行 starter skeleton 测试；
- [x] AC-2：测试能在应用注册表与动态加载清单 ID 不一致时失败；
- [x] AC-3：测试能在游戏目录包含未注册游戏时失败；
- [x] AC-4：窗口 reducer 覆盖初始、打开、聚焦、关闭、静默移除、最小化、最大化、贴靠和取消贴靠状态转换；
- [x] AC-5：关闭或最小化当前窗口后，焦点选择当前最上层可见窗口，没有可见窗口时回到桌面；
- [x] AC-6：`app/page.tsx` 不再通过 `useState` 和 `windowZRef` 分别维护窗口状态与 z-index；
- [x] AC-7：TypeScript 检查和全部 Vitest 单元测试通过；
- [x] AC-8：除测试入口和内部状态实现外，现有应用、窗口和构建命令保持不变。

## 验证计划

- TypeScript：`npx tsc --noEmit`
- 全部单测：`npm test`
- reducer 定向单测：`npm run test:unit -- tests/unit/windowState.test.ts`
- 应用清单定向单测：`npm run test:unit -- tests/unit/appRegistry.test.ts tests/unit/lazyApps.test.ts`
- 关键交互：通过 reducer 单测覆盖窗口转换；本次不启动浏览器进行 UI 测试
- 不执行的验证及原因：按照仓库约束不运行 lint 和完整构建

## 风险与迁移

- 已知风险：窗口回调同时包含 reducer 状态和 UI 副作用，接线时可能改变关闭或最小化后的焦点顺序；通过 reducer 测试和 page diff 审计控制；
- 数据迁移：无；
- 回滚方式：恢复 `page.tsx` 原有窗口状态代码和原测试脚本，不涉及用户数据回滚。

## 待确认项

- 无。已确认删除失效的 rendered HTML 测试，将 `npm test` 定位为无构建的默认单测入口；P0 不新增浏览器集成测试。

## 迭代拆分

1. 修正默认测试入口并移除过期 starter 测试；
2. 增加应用注册、动态加载和游戏目录的一致性测试；
3. 抽取窗口 reducer、接入桌面外壳并验证状态转换。

## 后续事项

- P1：建立 App Manifest 和 App Runtime；
- P1：建立统一 Storage Provider；
- P2：拆分应用 CSS，并从 Manifest 生成资源包配置；
- P2：拆分文件元数据与 Blob 内容；
- P3：根据产品路线决策多窗口实例和大型资源托管。

## 确认记录

- 2026-08-28：用户确认自动化推进既定路线，并接受 P0 的目标、修改范围、不修改边界、验收标准和两个待确认项。
