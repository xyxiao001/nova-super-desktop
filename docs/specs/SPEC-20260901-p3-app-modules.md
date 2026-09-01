# SPEC-20260901：P3 应用目录化与样式分包

- 状态：已完成
- 提出日期：2026-09-01
- 负责人：Codex

## 观察

- 应用入口、领域逻辑、Worker 和样式仍散落在 `app/`；
- Manifest loader 仍指向旧的扁平文件；
- `productivity-apps.css` 混合记事本、照片、资源管理器、文件夹和回收站；
- `games-tools.css` 混合游戏大厅、各游戏、计算器、画板、专注时钟和设置；
- 照片实验室样式仍位于全局样式和桌面样式中。

## 目标

将全部应用迁移到 `src/apps/<app-id>/`，每个应用提供默认 `entry.tsx`；按应用拆分 CSS，领域模块、Worker 和应用内组件与所属应用共置。

## 非目标

- 不修改应用行为、状态、Runtime 契约、存储 key 或备份格式；
- 不重写 CSS 视觉；
- 不修改窗口预设或实现自动扫描目录；
- 不迁移仍属于平台层的桌面文件、设置、存储和资源缓存模块；
- 不新增构建工具或依赖。

## 目录方案

```text
src/apps/
  <app-id>/
    entry.tsx
    <app-id>.css
    core.ts
    storage.ts
    *.worker.ts
  games/
    entry.tsx
    shared/
      GameResultDialog.tsx
      gameStorage.ts
      game-primitives.css
```

仅实际存在的文件进入目录，不创建空占位文件。

## 样式拆分

- `calendar.css`、`reader.css` 随应用移动；
- `productivity-apps.css` 按 notes、viewer、explorer、folder、recycle 拆分；
- `games-tools.css` 按 games、mines、chess、gomoku、tower、calculator、drawing、focus、settings 拆分；
- 游戏结果弹层作为游戏共享样式；
- 照片实验室规则从全局和桌面 CSS 提取到应用 CSS；
- CSS 规则使用 PostCSS AST 机械迁移，保持声明和媒体查询内容不变。

## 修改范围

### 计划新增

- `src/apps/*`
- `docs/iterations/ITER-20260901-p3-app-modules-01.md`

### 计划修改

- `app/appManifest.ts`
- `app/storageProviders.ts`
- `src/shell/DesktopRoot.tsx`
- 应用领域模块相关测试
- `README.md`

### 计划删除

- `app/` 下已迁移的应用组件、领域模块、Worker 和应用 CSS；
- `app/productivity-apps.css`
- `app/games-tools.css`

## 验收标准

- [x] 17 个 Manifest 应用均从 `src/apps/<app-id>/entry.tsx` 加载；
- [x] `app/` 不再保留应用组件和应用 CSS；
- [x] 应用领域模块、Worker 与所属应用共置；
- [x] 打开一个应用不再加载原共享应用 CSS；
- [x] 全局和桌面 CSS 不再包含照片实验室业务规则；
- [x] Manifest、Runtime、存储 Provider 和测试引用均指向新路径；
- [x] TypeScript、应用领域单测、Manifest、lazyApps 和样式架构测试通过；
- [x] diff 不包含产品行为、存储格式或资源生命周期修改。

## 验证计划

- `npx tsc --noEmit`
- 应用领域、Manifest、Runtime、lazyApps、Storage Provider 和样式架构相关单测
- CSS AST 可解析检查
- `git diff --check`
- 不运行 lint、完整构建或开发服务器

## 风险与控制

- 风险：批量移动遗漏相对路径；先移动后统一 TypeScript 检查，以编译错误驱动修复；
- 风险：媒体查询拆分丢失规则；使用 PostCSS AST 递归复制规则并检查零未归属规则；
- 风险：共享游戏样式重复或缺失；共用结果弹层保留独立 shared CSS；
- 风险：测试仍引用旧路径；以 `rg` 确认旧应用路径归零。
