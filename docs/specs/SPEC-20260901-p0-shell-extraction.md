# SPEC-20260901：P0 桌面外壳职责拆分

- 状态：已完成
- 提出日期：2026-09-01
- 负责人：Codex

## 观察

- `app/page.tsx` 同时承担路由入口、桌面状态协调、窗口框架、桌面图标、任务栏、系统面板和通用覆盖层；
- App Manifest、窗口 reducer、Storage Provider 和资源包协议已经独立，本阶段无需重新设计；
- Vercel SPA 入口与 vinext App Router 入口都需要继续复用同一个桌面根组件。

## 目标

建立稳定的桌面外壳目录，让路由入口只负责挂载桌面根组件，并把窗口框架、桌面图标交互、任务栏、系统面板和通用覆盖层从桌面控制器中提取出来。

## 非目标

- 不修改应用 Manifest、懒加载方式或应用 Props；
- 不扩展 App Runtime；
- 不修改窗口、文件、搜索、拖放、快捷键、存储、备份或 Service Worker 行为；
- 不迁移应用内部文件和 CSS；
- 不实现通用 AppHost、多实例、插件系统或新产品能力。

## 方案

1. `app/page.tsx` 变为路由适配层，只渲染 `DesktopRoot`；
2. `src/shell/DesktopRoot.tsx` 保留现有桌面状态与业务协调；
3. 提取 `WindowFrame`，封装窗口几何、拖动、缩放和窗口栏；
4. 提取桌面快捷方式与文件图标组件及其指针交互；
5. 提取任务栏、系统面板和通用覆盖层为纯展示组件；
6. 保持 `src/main.tsx` 继续通过 `app/page.tsx` 复用同一桌面入口。

## 目标目录

```text
app/
  page.tsx                         # vinext / App Router 路由适配层

src/
  main.tsx                         # Vercel SPA 入口，继续复用 app/page.tsx
  shell/
    DesktopRoot.tsx                # 桌面状态与跨领域业务协调
    WindowFrame.tsx                # 窗口栏、几何、拖动、缩放、贴靠交互
    DesktopIcons.tsx               # 桌面快捷方式、文件图标和长按/拖动交互
    DesktopTaskbar.tsx             # 任务栏、窗口预览和任务栏菜单
    DesktopSystemPanel.tsx         # 日历与文件通知面板
    DesktopOverlays.tsx            # 重命名、文件冲突、拖入提示、Toast、启动层
```

本阶段不移动 `app/` 下的应用组件、领域逻辑、存储文件和 CSS。目录迁移只覆盖桌面外壳。

## 职责边界

### `app/page.tsx`

- 只导入并渲染 `DesktopRoot`；
- 不保存 React 状态；
- 不直接引用具体应用、桌面文件或窗口 reducer。

### `DesktopRoot`

- 继续作为本阶段唯一桌面组合根；
- 保留窗口 reducer、桌面文件状态、应用专属状态和跨应用工作流；
- 向提取后的展示组件传递现有状态与命令；
- 本阶段不新增 Context，不改变状态所有权。

### `WindowFrame`

- 接收现有窗口状态和窗口命令；
- 拥有窗口几何读取、保存、拖动、缩放、贴靠选择和窗口栏渲染；
- 不读取桌面文件，不启动应用，不修改 Manifest；
- 保持单应用单窗口和现有 localStorage 几何 key 不变。

### `DesktopIcons`

- 包含 `DesktopShortcut`、`DesktopFile` 和现有图标指针交互 hook；
- 只处理点击、双击、长按、选择、拖动和文件夹拖放事件转发；
- 不直接修改桌面文件数组或持久化数据。

### `DesktopTaskbar` 与 `DesktopSystemPanel`

- 只负责现有任务栏、窗口预览、任务栏菜单、日历和通知 UI；
- 所有打开、最小化、最大化、关闭和定位文件行为由回调传入；
- 不复制窗口状态，不直接访问存储。

### `DesktopOverlays`

- 只负责现有重命名、文件冲突、拖放提示、Toast 和启动层；
- 不增加新的确认、校验、错误提示或兜底流程。

## 数据与状态归属

本阶段所有状态继续保留原有唯一来源：

- 窗口状态：`windowReducer`；
- 桌面文件：`DesktopRoot` 中的 `items`，通过现有同步队列写入 IndexedDB；
- 图标位置：`DesktopRoot` 中的 `positions`，继续使用 `nova-desktop-positions`；
- 窗口几何：`WindowFrame`，继续使用 `nova-window-geometry:<appId>`；
- 应用编辑状态：继续由各应用组件内部管理；
- 启动意图、通知、搜索和文件撤销：继续由 `DesktopRoot` 管理。

不新增重复状态，不迁移任何设备数据。

## 迭代拆分

### ITER-1：建立入口和桌面根组件

- 新建 `src/shell/DesktopRoot.tsx`；
- 将现有桌面实现机械迁移到该文件；
- 将 `app/page.tsx` 缩减为路由适配层；
- 不进行同时重构。

### ITER-2：提取窗口框架

- 提取 `WindowFrame` 及其几何持久化逻辑；
- 保持窗口 DOM 类名、事件顺序、尺寸限制和快捷键行为不变。

### ITER-3：提取桌面图标

- 提取快捷方式、文件图标和图标交互 hook；
- 保持 PC 拖动、移动端互相挤压、长按菜单和文件夹拖放不变。

### ITER-4：提取任务栏、系统面板和覆盖层

- 先提取纯展示结构，再由 `DesktopRoot` 传入原有命令；
- 不在本迭代引入新的 Runtime 或 Store。

### ITER-5：验证与文档更新

- 运行约定的 TypeScript 和定向单测；
- 更新本 Spec 状态、README 目录说明和对应迭代记录；
- 审计 diff，移除行为变化和超范围重构。

## 修改文件范围

### 计划新增

- `src/shell/DesktopRoot.tsx`
- `src/shell/WindowFrame.tsx`
- `src/shell/DesktopIcons.tsx`
- `src/shell/DesktopTaskbar.tsx`
- `src/shell/DesktopSystemPanel.tsx`
- `src/shell/DesktopOverlays.tsx`
- 对应的 `docs/iterations/ITER-*.md`

### 计划修改

- `app/page.tsx`
- `src/main.tsx`：仅当入口引用需要调整时修改；否则保持不变
- `tests/unit/appStyles.test.ts`：更新桌面根文件读取位置
- `README.md`：只更新项目结构说明

### 明确不修改

- `app/appManifest.ts`、`app/appRegistry.ts`、`app/lazyApps.ts`；
- `app/AppRuntime.tsx`、`app/windowState.ts`、`app/windowGeometry.ts`；
- 所有应用组件和应用 CSS；
- IndexedDB、localStorage key、备份版本和 Storage Provider；
- Service Worker、资源包配置、PWA Manifest 和版本号；
- 用户可感知的布局、文案、交互和动画。

## 风险与控制

- 风险：移动 JSX 时遗漏事件或改变事件冒泡顺序；通过保持原 DOM 结构和定向交互测试控制；
- 风险：组件提取后回调闭包依赖变化；本阶段只传递现有函数，不重写业务逻辑；
- 风险：双入口引用不同桌面实现；两个入口继续汇聚到同一个 `DesktopRoot`；
- 风险：大规模移动导致无关格式差异；每个迭代只移动一个职责，并审计 diff。

## 回滚方式

每个迭代保持独立提交。若验证失败，仅回滚对应组件提取，上一迭代已稳定的目录和入口不受影响；本阶段没有数据迁移，因此不需要设备数据回滚。

## 验收标准

- [x] `app/page.tsx` 不再包含桌面业务状态和窗口实现；
- [x] `DesktopRoot` 是两个构建入口复用的唯一桌面实现；
- [x] `WindowFrame` 不依赖桌面文件和具体应用；
- [x] 桌面图标组件不直接写入存储；
- [x] 任务栏、系统面板和覆盖层不拥有窗口或文件业务状态；
- [x] 所有应用打开、窗口操作、桌面图标、任务栏和弹层行为保持不变；
- [x] Vercel 与 vinext 入口继续指向同一桌面根组件；
- [x] TypeScript、窗口、桌面交互和样式相关单测通过；
- [x] 本次 diff 不包含应用内部、存储格式或产品行为修改。

## 验证计划

- `npx tsc --noEmit`；
- 运行窗口、桌面图标、注册表、Runtime 和样式相关单测；
- `git diff --check` 并审计目标文件差异；
- 不运行 lint 或完整构建。
