# ITER-20260901：应用目录化与样式分包

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260901-p3-app-modules.md`
- 对应验收项：全部验收项
- 开始日期：2026-09-01
- 完成日期：2026-09-01

## 本轮目标

将全部应用、领域模块、Worker 和应用样式迁移到 `src/apps/<app-id>/`，并消除共享应用 CSS 包。

## 本轮不做

- 不修改应用行为、Runtime 契约或窗口状态；
- 不修改存储 key、备份格式、资源包协议或 Service Worker；
- 不重做视觉。

## 实现结果

- 17 个应用均提供 `src/apps/<app-id>/entry.tsx`；
- 阅读器、日历、游戏、照片等领域模块和 Worker 已与应用共置；
- `productivity-apps.css` 拆为 5 个应用 CSS；
- `games-tools.css` 拆为 9 个应用 CSS 和游戏共享结果弹层样式；
- 照片实验室样式已从全局和桌面 CSS 移入 `src/apps/photo/photo.css`；
- Manifest、Storage Provider、DesktopRoot 和测试已更新到新路径。

## 实现—验证记录

### 第 1 轮

- 实现：完成文件迁移、导入修复和 Manifest loader 更新；
- 验证：`npx tsc --noEmit`；
- 结果：通过。

### 第 2 轮

- 实现：通过 PostCSS AST 拆分应用样式，并补充目录架构测试；
- 验证：完整单元测试、CSS 解析和规则覆盖审计；
- 结果：34 个测试文件、153 项测试通过；20 个 CSS 文件解析通过；原共享、全局和桌面规则全部被覆盖。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] `npm run test:unit`：34 个测试文件、153 项测试通过
- [x] 20 个 CSS 文件通过 PostCSS 解析
- [x] 原 `productivity-apps.css` 427 条规则全部覆盖
- [x] 原 `games-tools.css` 691 条规则全部覆盖
- [x] 原 globals 和 desktop CSS 业务规则全部覆盖
- [x] `git diff --check`
- [x] 未运行 lint
- [x] 未运行完整构建和开发服务器

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有修改存储格式、缓存协议或 Service Worker
- [x] 没有覆盖用户原有修改
- [x] 没有保留旧应用组件或共享应用 CSS

## 交付记录

- 完成结果：应用代码和样式已形成独立目录与按需分包边界；
- 用户可感知变化：无；
- 未实现能力：设置仍是兼容宿主；窗口配置、Storage Provider 和资源包尚未完全 Manifest 化；
- 新增或更新 ADR：无；
- 回写 Spec 的后续事项：剩余接入阻塞统一纳入第五阶段。
