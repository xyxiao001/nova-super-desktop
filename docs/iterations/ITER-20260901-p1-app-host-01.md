# ITER-20260901：建立通用 AppHost

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260901-p1-app-host.md`
- 对应验收项：全部验收项
- 开始日期：2026-09-01
- 完成日期：2026-09-01

## 本轮目标

让无需 Workspace Props 的应用由 Manifest 派生并通过统一 `AppHost` 渲染，删除对应的外壳分支和命名 Lazy 导出。

## 本轮不做

- 不迁移文件类应用和设置应用；
- 不扩展 Runtime；
- 不修改存储、资源包、Service Worker、应用目录或 CSS。

## 计划修改

- `app/appManifest.ts`、`app/appRegistry.ts`：声明并派生 runtime-hosted 应用；
- `app/lazyApps.ts`：生成 runtime-hosted 懒组件映射；
- `src/platform/apps/AppHost.tsx`：统一装配 Manifest 组件和 `WindowFrame`；
- `app/MagicTowerGame.tsx`、`app/CalculatorApp.tsx`、`app/FocusClockApp.tsx`：从 Runtime 读取 active；
- `src/shell/DesktopRoot.tsx`：以 Manifest 派生集合替换八个应用分支；
- 相关测试、Spec 和 README。

## 实现假设

八个应用都能在无外壳业务 Props 的条件下运行；其中 active 状态可由既有 Runtime 基于同一窗口状态计算，因此迁移不会改变状态来源或交互语义。

## 实现—验证记录

### 第 1 轮

- 实现：增加 `runtimeHosted` Manifest 契约、统一懒组件映射和 `AppHost`，迁移八个简单应用；
- 验证：TypeScript 检查和 9 个定向测试文件；
- 结果：TypeScript 通过，40 项测试通过。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] Manifest、Runtime、lazyApps、窗口及三个 active 应用相关单测：40 项通过
- [x] 外壳架构断言
- [x] `git diff --check`
- [x] 未运行 lint
- [x] 未运行完整构建和开发服务器

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：八个应用通过 Manifest 驱动的 `AppHost` 接入桌面；
- 用户可感知变化：无；
- 未实现能力：文件类应用和设置应用仍由 `DesktopRoot` 装配 Props；
- 新增或更新 ADR：无；
- 回写 Spec 的后续事项：下一阶段建立 WorkspaceRuntime 后迁移剩余文件类应用。
