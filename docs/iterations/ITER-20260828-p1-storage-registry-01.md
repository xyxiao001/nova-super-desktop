# ITER-20260828：建立 Storage Provider 注册表

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260828-p1-storage-providers.md`
- 对应验收项：AC-1、AC-6、AC-7、AC-8
- 开始日期：2026-08-28
- 完成日期：2026-08-28

## 本轮目标

用统一 Provider 注册表驱动设置页数据统计与分类清理。

## 本轮不做

- 不修改备份格式和应用写入行为。

## 计划修改

- `app/storageProviders.ts`
- `app/novaStorage.ts`
- Provider 与存储测试

## 实现假设

先迁移统计和清理可以验证 Provider 的数据所有权，再复用同一契约接入备份。

## 实现—验证记录

### 第 1 轮

- 实现：建立七类 Storage Provider，`novaStorage.ts` 改为遍历 Provider 统计和清理；游戏 Provider 统一覆盖游戏 localStorage、`HumanBreak_*` 和魔塔 IndexedDB；
- 验证：存储定向测试、TypeScript 和全部单测；
- 结果：设置页分类与清理测试通过，Provider 数据所有权保持原分类。

## 验证结果

- [x] TypeScript
- [x] 定向测试
- [x] 全部单测
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 符合本轮目标和 Spec 边界
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：统计和清理已由统一 Provider 注册表驱动；
- 用户可感知变化：无。
