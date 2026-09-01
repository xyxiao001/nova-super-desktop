# ITER-20260901：拆分桌面外壳职责

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260901-p0-shell-extraction.md`
- 对应验收项：第一阶段全部验收项
- 开始日期：2026-09-01
- 完成日期：2026-09-01

## 本轮目标

将路由入口、窗口框架、桌面图标、任务栏、系统面板和通用覆盖层从原 `app/page.tsx` 中分离，同时保持现有状态归属和产品行为。

## 本轮不做

- 不修改应用 Manifest、懒加载方式、Runtime、存储格式或应用 Props；
- 不迁移应用组件和 CSS；
- 不引入 AppHost、Context、Store 或新产品能力。

## 计划修改

- `app/page.tsx`：缩减为 `DesktopRoot` 路由适配层；
- `src/shell/DesktopRoot.tsx`：承接原桌面状态与业务协调；
- `src/shell/WindowFrame.tsx`：承接窗口交互与几何持久化；
- `src/shell/DesktopIcons.tsx`：承接桌面图标及指针交互；
- `src/shell/DesktopTaskbar.tsx`：承接任务栏、预览和菜单；
- `src/shell/DesktopSystemPanel.tsx`：承接日历与通知面板；
- `src/shell/DesktopOverlays.tsx`：承接通用覆盖层；
- `tests/unit/appStyles.test.ts`、`README.md`：更新入口断言和目录说明。

## 实现假设

机械迁移原 JSX、事件顺序和状态调用，并仅通过 Props 将命令传给展示组件，可以建立外壳边界而不改变用户行为。

## 实现—验证记录

### 第 1 轮

- 实现：完成路由入口和六个桌面外壳模块的提取，状态和跨应用工作流继续由 `DesktopRoot` 管理；
- 验证：执行 TypeScript 检查；
- 结果：通过。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] 窗口、桌面图标、注册表、Runtime 和样式相关单测：9 个测试文件、36 项测试通过
- [x] 关键交互：窗口几何、窗口 reducer、桌面图标交互和日历面板逻辑单测通过
- [x] `git diff --check`
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：桌面外壳已形成稳定目录，`app/page.tsx` 仅负责挂载 `DesktopRoot`；
- 用户可感知变化：无；
- 未实现能力：通用 AppHost、WorkspaceRuntime、应用目录化和 Storage Provider 模块化；
- 新增或更新 ADR：无；
- 回写 Spec 的后续事项：无。
