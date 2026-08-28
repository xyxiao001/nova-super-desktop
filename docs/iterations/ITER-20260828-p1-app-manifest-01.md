# ITER-20260828：建立 App Manifest

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260828-p1-app-platform.md`
- 对应验收项：AC-1、AC-2、AC-3、AC-6
- 开始日期：2026-08-28
- 完成日期：2026-08-28

## 本轮目标

将应用展示元数据和动态加载器合并为单一 Manifest，并派生现有兼容导出。

## 本轮不做

- 不建立 Runtime，不修改应用组件或窗口行为。

## 计划修改

- `app/appManifest.ts`
- `app/appRegistry.ts`
- `app/lazyApps.ts`
- 相关测试

## 实现假设

通过编译期 Manifest 统一声明并保留原导出，可以消除重复来源而不扩大调用方改动。

## 实现—验证记录

### 第 1 轮

- 实现：新增统一 App Manifest，并从它派生现有注册表、WindowAppId、loader 映射和 Lazy 组件；
- 验证：TypeScript、3 个相关测试文件和全部单测；
- 结果：相关 12 项测试、全部 23 个测试文件 105 项测试和 TypeScript 均通过。

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

- 完成结果：应用元数据和动态加载器已统一为单一权威来源；
- 用户可感知变化：无。
