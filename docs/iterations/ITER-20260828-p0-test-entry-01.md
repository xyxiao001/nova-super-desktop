# ITER-20260828：修正默认测试入口

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260828-p0-platform-foundation.md`
- 对应验收项：AC-1、AC-7、AC-8
- 开始日期：2026-08-28
- 完成日期：2026-08-28

## 本轮目标

让 `npm test` 直接运行当前 Vitest 单元测试，不隐式构建，也不再执行过期 starter skeleton 测试。

## 本轮不做

- 不修改单元测试内容、构建命令和产品代码。

## 计划修改

- `package.json`：调整 `test` 脚本；
- `tests/rendered-html.test.mjs`：删除过期测试。

## 实现假设

现有 `test:unit` 已覆盖当前有效测试，将默认入口委托给它即可建立快速且可信的测试命令。

## 实现—验证记录

### 第 1 轮

- 实现：将 `npm test` 改为调用 `test:unit`，删除过期的 `tests/rendered-html.test.mjs`；
- 验证：执行 `npm test` 和 `npx tsc --noEmit`；
- 结果：22 个测试文件、97 项测试全部通过，TypeScript 检查通过，测试输出未触发构建。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] `npm test`
- [x] 默认测试未触发构建
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：默认测试入口已修正，过期 starter 测试已移除；
- 用户可感知变化：无产品行为变化；
- 未实现能力：浏览器集成测试；
- 新增或更新 ADR：无；
- 回写 Spec 的后续事项：无。
