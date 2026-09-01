# SPEC-20260901：P1 通用 AppHost

- 状态：已完成
- 提出日期：2026-09-01
- 负责人：Codex

## 观察

- App Manifest 已统一应用元数据和 loader，但 `lazyApps.ts` 仍为每个应用维护命名 Lazy 导出；
- `DesktopRoot` 仍为每个应用直接渲染 `WindowFrame` 和 Lazy 组件；
- 日历、游戏大厅、扫雷、国际象棋和五子棋无需外壳 Props；
- 魔塔、计算器和专注时钟只需要当前窗口是否 active，可复用现有 App Runtime。

## 目标

建立由 Manifest 驱动的通用 `AppHost`，先迁移八个不依赖 Workspace Props 的应用，使这批应用不再需要 `DesktopRoot` 中的逐应用渲染分支或 `lazyApps.ts` 命名导出。

## 非目标

- 不迁移文件资源管理器、记事本、照片、照片实验室、画板、阅读器、文件夹和回收站；
- 不迁移设置应用的启动意图与设置 Props；
- 不扩展 App Runtime，不建立 WorkspaceRuntime；
- 不修改应用 ID、窗口行为、资源包、存储、备份或 Service Worker；
- 不移动应用目录或拆分 CSS。

## 方案

1. Manifest 为已迁移应用声明 `runtimeHosted: true`；
2. 注册表从 Manifest 派生 `RUNTIME_HOSTED_APPS`；
3. `lazyApps.ts` 生成统一 `lazyAppComponents` 映射，并移除已迁移应用的命名导出；
4. 新建 `src/platform/apps/AppHost.tsx`，通过应用 ID 读取 Manifest 懒组件并统一渲染 `WindowFrame`；
5. 魔塔、计算器和专注时钟通过现有 `useAppRuntime().isAppActive` 获取 active；
6. `DesktopRoot` 遍历 `RUNTIME_HOSTED_APPS` 渲染这批应用，保留其他应用的现有分支。

## 数据与状态归属

- 窗口状态仍由 `DesktopRoot` 的 `windowReducer` 管理；
- `AppHost` 不拥有窗口状态，只接收现有状态和命令；
- 应用 active 状态由 App Runtime 从同一窗口状态计算；
- 不新增持久化数据。

## 修改范围

### 计划新增

- `src/platform/apps/AppHost.tsx`
- `docs/iterations/ITER-20260901-p1-app-host-01.md`

### 计划修改

- `app/appManifest.ts`
- `app/appRegistry.ts`
- `app/lazyApps.ts`
- `app/MagicTowerGame.tsx`
- `app/CalculatorApp.tsx`
- `app/FocusClockApp.tsx`
- `src/shell/DesktopRoot.tsx`
- 相关单测与 README

### 明确不修改

- 文件类应用 Props 和业务逻辑；
- `AppRuntime.tsx` 能力；
- 窗口 reducer 与几何逻辑；
- 存储、备份、缓存和 Service Worker；
- 产品文案、布局和交互。

## 验收标准

- [x] 八个 runtime-hosted 应用由 Manifest 派生并通过 `AppHost` 渲染；
- [x] `DesktopRoot` 不再包含这八个应用的独立渲染分支；
- [x] `lazyApps.ts` 不再包含这八个应用的命名 Lazy 导出；
- [x] 魔塔、计算器和专注时钟不再接收外壳 active Props；
- [x] 未迁移应用继续沿用原 Props 和加载行为；
- [x] TypeScript、Manifest、Runtime、懒加载和外壳架构相关单测通过；
- [x] 本次 diff 不包含产品行为、存储或资源生命周期修改。

## 验证计划

- `npx tsc --noEmit`
- Manifest、Runtime、lazyApps、外壳架构及三个 active 应用的相关单测
- `git diff --check`
- 不运行 lint、完整构建或开发服务器

## 风险与控制

- 风险：动态组件映射弱化 Props 类型；仅允许 `runtimeHosted` 的零 Props 应用进入 `AppHost`，并通过类型和清单测试约束；
- 风险：active 状态迁移后键盘或计时行为变化；复用现有 `isAppActive` 判定，不修改应用内部 effect；
- 风险：迁移集合与 Manifest 不一致；只从 Manifest 派生，不维护第二份 ID 清单。
