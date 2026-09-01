# SPEC-20260901：P2 WorkspaceRuntime 与文件应用迁移

- 状态：已完成
- 提出日期：2026-09-01
- 负责人：Codex

## 观察

- `DesktopRoot` 仍为八个文件类应用装配桌面文件、当前文件、文件命令和启动意图；
- 这些 Props 使桌面外壳理解各应用的业务接口，并阻止应用进入通用 `AppHost`；
- 启动意图与文件工作区属于不同职责，不应合并到同一个 Runtime。

## 目标

建立 `WorkspaceRuntime` 和 `LaunchRuntime`，迁移文件资源管理器、记事本、照片、照片实验室、画板、阅读器、文件夹和回收站，使这些应用通过 `AppHost` 接入且不再接收桌面外壳 Props。

## 非目标

- 不迁移设置应用；
- 不改变窗口 reducer、文件命令、持久化队列或数据结构；
- 不修改备份格式、Storage Provider、资源包或 Service Worker；
- 不移动应用目录或拆分 CSS；
- 不新增状态库、远端能力、多窗口实例或兼容分支。

## 方案

1. 新建 `WorkspaceRuntime`，暴露现有桌面文件快照、当前工作对象和文件命令；
2. 新建 `LaunchRuntime`，只暴露按应用读取启动意图和确认已处理命令；
3. `DesktopRoot` 继续拥有全部状态和命令，通过两个 Provider 提供现有值；
4. 八个文件类应用改为从对应 Runtime 读取依赖；
5. Manifest 将八个应用标记为 `runtimeHosted`，由 `AppHost` 统一加载和渲染；
6. `DesktopRoot` 只保留设置应用的专用 Props 分支。

## Runtime 边界

### WorkspaceRuntime

- 文件集合：全部文件、可见文件、笔记、照片、回收站项目；
- 当前对象：当前笔记、照片、照片编辑源、文件夹和文件夹子项；
- 文件命令：打开、选择、创建、更新、重命名、复制/移动、粘贴、删除、恢复、清空回收站、保存图片和创建阅读摘录；
- 不拥有状态，不直接访问 IndexedDB 或 localStorage。

### LaunchRuntime

- 按应用 ID 返回当前启动意图；
- 确认指定请求已处理；
- 不解释文件内容，不执行窗口命令。

## 修改范围

### 计划新增

- `src/platform/workspace/WorkspaceRuntime.tsx`
- `src/platform/launch/LaunchRuntime.tsx`
- `docs/iterations/ITER-20260901-p2-workspace-runtime-01.md`

### 计划修改

- `src/shell/DesktopRoot.tsx`
- `src/platform/apps/AppHost.tsx`
- `app/appManifest.ts`
- `app/lazyApps.ts`
- 八个文件类应用组件
- 相关单测与 README

### 明确不修改

- `app/desktopFiles.ts` 和 `app/desktopStorage.ts` 的行为；
- IndexedDB、localStorage key 和同步队列；
- 设置应用 Props；
- 应用样式、资源缓存和发布版本。

## 验收标准

- [x] `WorkspaceRuntime` 和 `LaunchRuntime` 不拥有或持久化状态；
- [x] 八个文件类应用不再声明桌面外壳 Props；
- [x] 八个文件类应用通过 Manifest 派生集合和 `AppHost` 渲染；
- [x] `DesktopRoot` 只保留设置应用的专用渲染分支；
- [x] `lazyApps.ts` 只保留设置应用的兼容命名导出；
- [x] 文件打开、编辑、创建、保存、移动、删除、恢复和启动意图语义不变；
- [x] TypeScript、文件、Runtime、Manifest、懒加载和外壳架构相关单测通过；
- [x] diff 不涉及存储格式、资源生命周期或产品行为修改。

## 验证计划

- `npx tsc --noEmit`
- Workspace、Launch、文件、Manifest、Runtime、lazyApps 和外壳架构相关定向单测
- `git diff --check`
- 不运行 lint、完整构建或开发服务器

## 风险与控制

- 风险：Context 回调变化触发应用 effect；保留原回调语义，并对启动意图处理做定向测试；
- 风险：照片实验室失去按来源文件 remount；在应用边界按来源 ID 保留原 key 行为；
- 风险：动态窗口标题丢失；继续由 `DesktopRoot` 从同一当前对象计算标题；
- 风险：Runtime 变成全局杂项容器；只纳入桌面文件工作区能力，启动意图保持独立。
