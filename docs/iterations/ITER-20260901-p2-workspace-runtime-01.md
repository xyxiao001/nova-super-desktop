# ITER-20260901：建立 WorkspaceRuntime

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260901-p2-workspace-runtime.md`
- 对应验收项：全部验收项
- 开始日期：2026-09-01
- 完成日期：2026-09-01

## 本轮目标

通过独立的 Workspace 和 Launch Runtime 迁移八个文件类应用，删除 `DesktopRoot` 对这些应用的 Props 装配和渲染分支。

## 本轮不做

- 不迁移设置应用；
- 不修改文件数据结构、持久化、备份、资源缓存或 Service Worker；
- 不移动应用目录或拆分 CSS。

## 计划修改

- `src/platform/workspace/WorkspaceRuntime.tsx`：定义桌面文件快照与命令契约；
- `src/platform/launch/LaunchRuntime.tsx`：定义启动意图读取和确认契约；
- 八个文件类应用：改为读取对应 Runtime；
- Manifest、AppHost、lazyApps 和 DesktopRoot：完成统一宿主接入；
- 相关测试、Spec 和 README。

## 实现假设

Runtime 仅转发现有状态与命令，不拥有状态或访问存储；应用改用 Context 后仍调用同一函数，因此文件与窗口行为保持不变。

## 实现—验证记录

### 第 1 轮

- 实现：建立两个 Runtime，迁移八个文件类应用，并保留照片来源切换时的编辑器重建语义；
- 验证：TypeScript 检查和 14 个定向测试文件；
- 结果：TypeScript 通过，20 个测试文件、103 项测试通过。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] Workspace、Launch、文件、Manifest、Runtime、lazyApps 和窗口相关单测：20 个测试文件、103 项通过
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

- 完成结果：文件类应用已通过 Workspace/Launch Runtime 接入通用 AppHost；
- 用户可感知变化：无；
- 未实现能力：设置应用仍使用专用 Props，窗口 Runtime 尚沿用 `AppRuntime` 名称；
- 新增或更新 ADR：无；
- 回写 Spec 的后续事项：设置与通知 Runtime 留待后续阶段。
