# ITER-20260828：兼容 v1 备份并验证魔塔恢复

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260828-p1-storage-providers.md`
- 对应验收项：AC-4、AC-5、AC-6、AC-8
- 开始日期：2026-08-28
- 完成日期：2026-08-28

## 本轮目标

确定性规范化 v1 备份，并用 fake IndexedDB 验证魔塔完整导出、恢复和清理。

## 本轮不做

- 不补造旧备份中不存在的魔塔数据，不增加恢复兜底。

## 计划修改

- `app/novaBackup.ts`
- `tests/unit/storageProviders.test.ts`
- `tests/unit/novaBackup.test.ts`
- `tests/unit/novaStorage.test.ts`

## 实现假设

将 v1 在解析阶段映射到 v2 Provider 数据，可以让恢复路径保持唯一。

## 实现—验证记录

### 第 1 轮

- 实现：v1 备份在解析阶段确定性规范化为 v2；增加魔塔 IndexedDB 与 `HumanBreak_*` 的导出、清理、恢复和完整备份往返测试；
- 验证：3 个存储相关测试文件 12 项测试、全部 25 个测试文件 111 项测试、TypeScript 和 diff 检查；
- 结果：全部通过，旧备份缺失的魔塔数据保持为空且不补造。

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

- 完成结果：v1 兼容和魔塔完整备份生命周期已验证；
- 用户可感知变化：旧备份可继续导入，魔塔数据可完整恢复。
