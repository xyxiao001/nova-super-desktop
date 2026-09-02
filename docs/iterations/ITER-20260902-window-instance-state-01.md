# ITER-20260902：窗口实例状态契约

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260902-window-instances.md`
- 对应验收项：AC-1、AC-4、AC-6、AC-9
- 开始日期：2026-09-02
- 完成日期：2026-09-02

## 本轮目标

建立 `WindowInstanceId`、实例目标、实例级窗口 reducer、查询函数和 Manifest 默认实例策略，并通过纯函数测试固定契约；现有桌面继续使用应用级窗口 reducer，不产生用户可感知变化。

## 本轮不做

- 不把 `DesktopRoot`、`AppHost`、Window Runtime、任务栏或 `Alt + Tab` 接入实例状态；
- 不启用资源管理器、文件夹、记事本或照片查看器的多实例策略；
- 不迁移应用当前工作对象或启动意图；
- 不修改窗口 UI、几何持久化、文件数据、备份或 Service Worker。

## 计划修改

- `src/platform/apps/appManifest.ts`：增加窗口实例策略类型和可选声明；
- `src/platform/apps/appRegistry.ts`：为所有应用派生默认 `singleton` 策略；
- `src/platform/windows/windowInstanceState.ts`：新增实例状态、动作、reducer 和查询函数；
- `tests/unit/appRegistry.test.ts`：验证默认实例策略；
- `tests/unit/windowInstanceState.test.ts`：验证实例生命周期、资源去重查询和窗口状态隔离；
- `docs/specs/SPEC-20260902-window-instances.md`：关联本迭代。

## 实现假设

先以未接入 UI 的纯状态模块固定实例身份和状态转换，可以在不改变现有行为的前提下验证窗口实例模型，并让下一轮宿主迁移只负责接线。

## 实现—验证记录

### 第 1 轮

- 实现：新增 Manifest 实例策略类型和 Registry 默认 `singleton` 归一化；新增实例 ID、目标、状态、动作、reducer 及应用、资源、顶层窗口查询函数；
- 验证：执行 TypeScript 检查及实例状态、注册表、现有窗口 reducer 定向测试；
- 结果：发现并修复 Registry 类型导出语法问题；TypeScript 和 3 个测试文件共 21 项测试通过。

### 第 2 轮

- 实现：将实例 ID 收紧为 `${appId}:${token}` 格式；为已关闭实例的陈旧动作增加无操作语义，并补充既有实例重新打开时保留资源目标的测试；
- 验证：再次执行 TypeScript 检查及相同定向测试；
- 结果：TypeScript 通过，3 个测试文件共 23 项测试通过。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] `tests/unit/windowInstanceState.test.ts`：10 项通过
- [x] `tests/unit/appRegistry.test.ts`：6 项通过
- [x] 现有 `tests/unit/windowState.test.ts`：7 项通过
- [x] 关键交互不适用，本轮未接入运行时或 UI
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：窗口实例状态契约和 Manifest 默认策略已建立，并由纯函数测试覆盖；
- 用户可感知变化：无；
- 未实现能力：实例宿主接入、任务栏分组和首批应用多实例；
- 新增或更新 ADR：沿用 `ADR-0006-window-instance-model.md`；
- 回写 Spec 的后续事项：无。
