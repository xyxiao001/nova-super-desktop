# ITER-20260902：统一窗口实例宿主

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260902-window-instances.md`
- 对应验收项：AC-1、AC-6、AC-7、AC-9、AC-12、AC-13
- 开始日期：2026-09-02
- 完成日期：2026-09-02

## 本轮目标

将 `DesktopRoot`、`AppHost`、Window Runtime、Launch Runtime、`WindowFrame`、任务栏和 `Alt + Tab` 接入 `WindowInstanceId`，同时让所有应用继续使用固定单例实例并保持现有用户行为。

## 本轮不做

- 不开放资源管理器“新建窗口”或任何第二实例入口；
- 不启用 Manifest 的 `multiple` 或 `per-resource` 策略；
- 不迁移文稿、图片和文件夹的全局当前对象；
- 不改变任务栏视觉、窗口预览布局、文件数据、备份或 Service Worker；
- 不实现跨窗口拖放。

## 计划修改

- `src/platform/windows/windowInstanceState.ts`：补齐单例实例 ID 和行为保持所需动作；
- `src/platform/windows/windowState.ts`：删除已被实例 reducer 取代的旧状态模型；
- `src/platform/windows/WindowRuntime.tsx`：改为实例集合、实例上下文、实例标题和关闭事件；
- `src/platform/launch/LaunchRuntime.tsx`：按实例保存和消费启动意图；
- `src/platform/apps/AppHost.tsx`：按实例渲染应用并提供实例上下文；
- `src/shell/WindowFrame.tsx`：接收实例 ID；
- `src/shell/DesktopTaskbar.tsx`：从实例集合派生单例应用窗口状态；
- `src/shell/DesktopRoot.tsx`：使用实例 reducer 管理全部窗口；
- `src/apps/games/entry.tsx`、`src/apps/wolfslot/entry.tsx`：迁移窗口查询和关闭订阅；
- `tests/unit/`：更新 Runtime 测试并补充实例宿主架构契约。

## 实现假设

每个应用先固定使用 `${appId}:main` 实例，可以让所有窗口路径切换到实例身份，同时保持一个应用最多一个窗口；后续开放多实例时只需改变创建和选择实例的命令，不再替换底层宿主。

## 实现—验证记录

### 第 1 轮

- 实现：将 Window Runtime、Launch Runtime、AppHost、WindowFrame、DesktopRoot、任务栏、快捷键、游戏大厅和老虎机关闭订阅迁移到固定单例实例 ID；
- 验证：执行 TypeScript 和窗口、Runtime、注册表、外壳架构相关定向测试；
- 结果：生产代码通过类型检查；旧测试仍使用应用级状态和缺少实例 Provider，3 项测试失败。

### 第 2 轮

- 实现：更新 Runtime 与架构测试夹具；删除无生产引用的旧 `windowState.ts` 及其测试；关闭或销毁实例时清理启动意图；
- 验证：执行 TypeScript 和 8 个相关测试文件；
- 结果：TypeScript 通过，8 个测试文件共 37 项测试通过。

### 第 3 轮

- 实现：将实例集合收紧为稀疏映射，统一通过 `allWindowInstances` 枚举；修正销毁聚焦实例后的焦点归属；
- 验证：执行 TypeScript 和窗口、Runtime、应用架构、文件关联、文件生命周期及游戏相关定向测试；
- 结果：TypeScript 通过，11 个测试文件共 63 项测试通过。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] 11 个相关测试文件、63 项测试通过
- [x] 旧窗口 reducer 已由实例 reducer 等价替代并删除
- [x] 关键交互不适用，本轮不开放多实例入口
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：窗口生命周期、宿主、标题、关闭事件、启动意图、任务栏和快捷键已统一使用实例身份；
- 用户可感知变化：无；
- 未实现能力：多实例创建、任务栏实例列表和资源实例化；
- 新增或更新 ADR：沿用 `ADR-0006-window-instance-model.md`；
- 回写 Spec 的后续事项：无。
