# SPEC-20260901：P4 声明式应用接入收口

- 状态：已完成
- 提出日期：2026-09-01
- 负责人：Codex

## 执行前审计

第四阶段后，普通无独立存储应用已经可以通过以下步骤接入：

1. 新建 `src/apps/<app-id>/`；
2. 提供默认 `entry.tsx`；
3. 在 Manifest 添加应用声明并设置 `runtimeHosted: true`；
4. 可选在入口导入应用 CSS；
5. 添加应用自身测试。

此路径不需要修改 `page.tsx`、`lazyApps.ts`、窗口外壳或任务栏。

但完整目标仍有以下缺口：

1. 设置应用仍通过 `LazySettingsApp` 和 `DesktopRoot` 专用分支接入；
2. `runtimeHosted` 是迁移期标记，新应用仍需知道这一内部细节；
3. 初始窗口尺寸和两个最小尺寸仍位于 `desktop.css` 与 `WindowFrame`；
4. 动态窗口标题和文件夹可用性仍在 `DesktopRoot` 按应用 ID 判断；
5. Storage Provider 类型、实现和注册仍集中在 `storageProviders.ts`；
6. 新资源包仍需修改独立的 `RESOURCE_PACKAGE_MANIFESTS`；
7. Manifest、Registry 和 Lazy 组件映射仍分散在 `app/` 下的三个模块。

## 目标

完成声明式应用接入收口，使所有应用默认由 Manifest 和 AppHost 接管；普通应用只新增应用目录、默认入口、Manifest 声明和测试，可选声明 CSS、窗口配置、资源包与 Storage Provider。

## 非目标

- 不自动扫描目录；
- 不引入远程插件、账号、云存储或新状态库；
- 不改变桌面文件格式；
- 不为未知未来能力增加兼容分支；
- 没有新的独立数据类型时，不提前升级 NOVA 备份版本。

## 实施顺序

### 迭代 1：全部应用统一宿主

- 新建 `SettingsRuntime`，提供设置快照与更新命令；
- 设置应用通过现有 `LaunchRuntime` 获取启动意图；
- 将设置标记迁移为通用宿主；
- 删除 `LazySettingsApp` 和 `DesktopRoot` 最后一个专用应用分支；
- 删除 `runtimeHosted`、`RuntimeHostedAppId` 和 `RUNTIME_HOSTED_APPS`，`AppHost` 直接覆盖全部 `REGISTERED_APPS`。

验收：所有应用都从同一个 Manifest 集合渲染，新增应用不存在宿主模式选择。

### 迭代 2：窗口配置 Manifest 化

- Manifest 增加：

```ts
window: {
  size: "compact" | "standard" | "wide" | "canvas";
  minWidth?: number;
  minHeight?: number;
  mobile: "fullscreen";
}
```

- `WindowFrame` 从 Manifest 读取预设和最小尺寸；
- 使用平台 CSS 变量或统一 size class 替换 `.<app-id>-window`；
- 删除 `WINDOW_MINIMUMS` 和桌面 CSS 中的应用窗口尺寸；
- 为动态标题提供 Window Runtime 标题覆盖命令，移除 `DesktopRoot` 中的应用 ID 判断；
- 文件夹窗口的可用性由打开命令保证，不在宿主循环中特判。

验收：新应用选择窗口预设或可选最小尺寸即可，不修改窗口组件和桌面 CSS。

### 迭代 3：应用注册模块收口

- 将 Manifest、Registry 和 lazy component map 合并到 `src/platform/apps/`；
- 删除 `app/lazyApps.ts`；
- `AppHost` 直接从统一注册表获取 loader、元数据和窗口配置；
- 路由入口、桌面外壳、任务栏和开始菜单只消费注册表派生数据；
- 增加契约测试，模拟新增应用并验证所有派生集合自动包含该应用。

验收：新增普通应用只修改一处 Manifest，不存在第二份应用清单。

### 迭代 4：资源包声明并入应用 Manifest

- 保留系统级资源包；
- 应用级资源包改为 Manifest 可选字段；
- Service Worker 资源配置和设置页统计从统一 Manifest 派生；
- 继续生成并校验 `public/resource-packages.generated.js`；
- 不改变现有缓存命名和清理协议。

验收：应用提供资源包配置时，无需修改独立平台清单。

### 迭代 5：Storage Provider 模块化

- 拆分现有 Provider：

```text
src/platform/storage/providers/
  desktop.ts
  games.ts
  localSettings.ts
  registry.ts

src/apps/reader/storageProvider.ts
src/apps/calendar/storageProvider.ts
```

- Manifest 支持可选的 Provider loader 列表；
- 设置页、统计、清理和备份统一从 Provider registry 获取；
- 保持当前 provider ID、存储 key 和备份 v3 格式不变；
- 等第一款新增独立数据类型的应用接入时，再设计 `providerId + dataVersion` 的下一版备份格式。

验收：现有 Provider 不再集中在一个文件；新增应用 Provider 的实现与应用共置，接入时不修改设置页和外壳。

## 最终契约

```text
src/apps/<app-id>/
  entry.tsx
  <app-id>.css              # 可选
  storageProvider.ts       # 可选
  *.test.ts                # 应用自身测试
```

Manifest 单条声明负责：

- 应用元数据和 loader；
- 启动器、开始菜单和任务栏可见性；
- 窗口预设；
- 可选资源包；
- 可选 Storage Provider。

## 最终验收

- [x] 所有应用由 `AppHost` 和同一注册表渲染；
- [x] `DesktopRoot` 不含应用组件 import、应用渲染分支或应用 ID 标题判断；
- [x] `app/lazyApps.ts` 删除；
- [x] `WindowFrame` 和桌面 CSS 不含应用 ID 尺寸配置；
- [x] 新应用无需修改 `page.tsx`、窗口外壳、任务栏、开始菜单或 lazy registry；
- [x] 新资源包和 Storage Provider 均从 Manifest 派生；
- [x] 现有存储 key、备份 v3、缓存协议和产品行为保持不变；
- [x] TypeScript、完整单测和声明式接入契约测试通过。
