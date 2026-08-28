# ITER-20260828：建立 App Runtime

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260828-p1-app-platform.md`
- 对应验收项：AC-4、AC-5、AC-6
- 开始日期：2026-08-28
- 完成日期：2026-08-28

## 本轮目标

提供最小桌面运行时，并迁移游戏大厅使用运行时窗口状态和打开能力。

## 本轮不做

- 不批量迁移其他应用，不改变窗口或游戏行为。

## 计划修改

- `app/AppRuntime.tsx`
- `app/page.tsx`
- `app/GameHall.tsx`
- 相关测试

## 实现假设

让游戏大厅成为首个 Runtime 使用者足以验证运行时边界，并能删除一组明显的手工 Props。

## 实现—验证记录

### 第 1 轮

- 实现：新增最小 App Runtime，桌面外壳提供现有窗口状态和打开能力，游戏大厅改为直接使用 Runtime；
- 验证：Runtime 定向测试、Manifest/注册表定向测试、TypeScript 和全部单测；
- 结果：定向 6 项测试、全部 24 个测试文件 106 项测试和 TypeScript 均通过。

## 验证结果

- [x] TypeScript
- [x] 相关单测
- [x] 全部单测
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 符合本轮目标和 Spec 边界
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：Runtime 已建立，游戏大厅的运行状态与启动 Props 已移除；
- 用户可感知变化：无。
