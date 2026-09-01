# ITER-20260901：声明式应用接入收口

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260901-p4-declarative-app-integration.md`
- 对应验收项：全部验收项
- 开始日期：2026-09-01
- 完成日期：2026-09-01

## 本轮目标

消除应用接入的剩余外壳接线，使应用组件、窗口配置、资源包和 Storage Provider 都从统一 Manifest 派生。

## 实现结果

- 设置应用迁移到 `SettingsRuntime` 和 `LaunchRuntime`；
- 17 个应用统一由 `REGISTERED_APPS` 和 `AppHost` 渲染；
- 删除 `runtimeHosted` 迁移标记和设置专用渲染分支；
- 窗口 Runtime、状态和几何模块迁入 `src/platform/windows/`；
- 动态窗口标题由应用通过 Window Runtime 设置；
- 窗口预设、初始尺寸、最小尺寸和移动端模式进入 Manifest；
- Manifest、Registry 和 Lazy 组件映射收口到 `src/platform/apps/`；
- 删除 `app/lazyApps.ts`；
- 应用资源包声明进入对应 Manifest 条目；
- Storage Provider 拆分为平台 Provider 和应用 Provider，并由 Manifest 懒加载；
- 游戏、阅读记录、专注记录和设置 Provider 已迁回对应旧应用目录；
- 保持 NOVA 备份 v3、Provider ID、存储 key 和缓存协议不变。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] `npm run test:unit`：34 个测试文件、156 项测试通过
- [x] 窗口 CSS 通过 PostCSS 解析
- [x] 声明式应用接入架构测试通过
- [x] `git diff --check`
- [x] 未运行 lint
- [x] 未运行完整构建和开发服务器

## Diff 审计

- [x] `DesktopRoot` 不再渲染任何专用应用组件
- [x] `WindowFrame` 不再维护应用最小尺寸表
- [x] `desktop.css` 不再维护应用 ID 窗口尺寸
- [x] Registry 不再维护第二份应用 ID 清单
- [x] 新资源包和应用 Provider 不要求修改设置页或桌面外壳
- [x] 没有修改备份版本、存储 key 或 Service Worker 缓存协议

## 后续边界

首次接入新的独立数据类型时，需要按既定约束单独设计包含 `providerId + dataVersion` 的下一版备份格式；本轮不提前升级。
