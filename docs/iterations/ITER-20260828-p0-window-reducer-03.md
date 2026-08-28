# ITER-20260828：抽取窗口 reducer

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260828-p0-platform-foundation.md`
- 对应验收项：AC-4、AC-5、AC-6、AC-7、AC-8
- 开始日期：2026-08-28
- 完成日期：2026-08-28

## 本轮目标

将窗口状态转换抽取为纯 reducer 并接入桌面外壳，保持现有窗口行为不变。

## 本轮不做

- 不修改窗口 UI、几何持久化、启动意图、快捷键语义或多实例能力。

## 计划修改

- `app/windowState.ts`：新增窗口 reducer；
- `tests/unit/windowState.test.ts`：新增状态转换测试；
- `app/page.tsx`：接入 reducer。

## 实现假设

集中管理窗口状态和 z-index 可以在不改变 UI 副作用的前提下建立后续运行时抽象所需的稳定边界。

## 实现—验证记录

### 第 1 轮

- 实现：新增纯窗口 reducer 和状态类型，将 `page.tsx` 的窗口状态、焦点与 z-index 接入 reducer；页面继续负责声音和菜单等 UI 副作用；
- 验证：执行 reducer 定向单测、TypeScript 检查和全部单测；检查 `page.tsx` 不再包含旧窗口 state/ref；
- 结果：reducer 7 项测试通过；全部 23 个测试文件、105 项测试通过；TypeScript 检查通过。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] reducer 定向单测
- [x] 全部单测
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：窗口状态转换和 z-index 已由可单测 reducer 统一管理；
- 用户可感知变化：无；
- 未实现能力：多窗口实例；
- 新增或更新 ADR：无；
- 回写 Spec 的后续事项：无。
