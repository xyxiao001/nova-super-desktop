# ITER-20260903：系统级 AI 多连接配置

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260903-desktop-pet-system.md`
- 对应验收项：AC-AI-1、AC-AI-5、AC-AI-8、AC-AI-9
- 开始日期：2026-09-03
- 完成日期：2026-09-03

## 本轮目标

建立独立的本地 AI 连接配置边界，并在设置应用中支持多套配置的新增、编辑、删除、手动切换、权限设置和全部清除。

## 本轮不做

- 不实现桌面宠物本体、活动事件或宠物状态；
- 不实现测试连接、AI 对话、请求重试或自动切换；
- 不把 AI 配置接入普通备份或 Storage Provider；
- 不修改 Service Worker 缓存策略；
- 不运行 lint 或完整构建。

## 计划修改

- `app/aiConnectionStorage.ts`：独立 IndexedDB 仓储和配置操作；
- `src/apps/settings/AiConnectionSettings.tsx`：连接与权限管理；
- `src/apps/settings/entry.tsx`、`settings.css`：设置分类接入和响应式样式；
- `src/shell/DesktopRoot.tsx`：设置搜索入口；
- `tests/unit/aiConnectionStorage.test.ts`：数据生命周期与隔离边界测试；
- `docs/adrs/ADR-0007-local-ai-connection-boundary.md`：敏感连接配置存储决策。

## 实现假设

设置 UI 只读取不含完整 Key 的配置摘要；专用仓储在更新时读取旧 Key 并支持留空保留。当前连接 ID 与档案放在同一数据库中，删除当前档案可在单个事务内将选择置空。

## 实现—验证记录

### 第 1 轮

- 实现：新增独立 IndexedDB 仓储、设置页 AI 分类、多配置 CRUD、手动选择、权限设置、Key 掩码和独立清除；
- 验证：TypeScript 通过；AI 仓储与应用样式共 9 项相关测试通过；
- 结果：发现 AI 弹窗位于滚动容器内可能被裁剪，进入第 2 轮调整。

### 第 2 轮

- 实现：使用 Portal 将 AI 表单和确认弹窗挂载到设置应用根节点；
- 验证：TypeScript、9 项相关测试和 `git diff --check` 通过；
- 结果：目标完成。

## 验证结果

- [x] `npx tsc --noEmit --incremental false`
- [x] 相关单测：`tests/unit/aiConnectionStorage.test.ts`、`tests/unit/appStyles.test.ts`，共 9 项
- [ ] 未启动开发环境，因此未执行浏览器关键交互；仓储生命周期由单测覆盖
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：多套 AI 连接和当前选择只写入 `nova-ai-connections`，删除当前配置后保持未选择；
- 用户可感知变化：设置中新增 AI 分类，可管理连接、启用状态和上下文权限；
- 未实现能力：测试连接、宠物对话、请求失败处理和任何联网请求；
- 新增或更新 ADR：`ADR-0007-local-ai-connection-boundary.md`；
- 回写 Spec 的后续事项：已标记本轮覆盖的 AI 验收项。
