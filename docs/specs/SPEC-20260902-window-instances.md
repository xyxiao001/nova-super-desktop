# SPEC-20260902：窗口实例化与并行工作区

- 状态：已接受
- 提出日期：2026-09-02
- 负责人：Codex
- 相关 ADR：`docs/adrs/ADR-0005-defer-multi-instance-external-assets.md`、`docs/adrs/ADR-0006-window-instance-model.md`
- 相关迭代：`docs/iterations/ITER-20260902-window-instance-state-01.md`、`docs/iterations/ITER-20260902-window-instance-host-02.md`、`docs/iterations/ITER-20260902-explorer-folder-instances-03.md`、`docs/iterations/ITER-20260902-note-viewer-instances-04.md`、`docs/iterations/ITER-20260902-window-instances-acceptance-05.md`

## 背景

NOVA 已完成应用 Manifest、`AppHost`、窗口 Runtime、Workspace Runtime、Launch Runtime、资源包和 Storage Provider 的声明式接入，但窗口系统仍以 `WindowAppId` 作为唯一运行身份：

- `WindowStateMap`、焦点和 z-index 均以应用 ID 为键；
- `AppHost` 为每个注册应用最多渲染一个窗口；
- 窗口标题、关闭通知和持久化几何均以应用 ID 标识；
- `DesktopRoot` 中的当前文稿、图片和文件夹也是应用级单值；
- 任务栏、窗口预览和 `Alt + Tab` 展示的是应用，而不是窗口实例。

因此，同一应用不能同时承载两个独立工作对象。用户打开第二个文件夹、文稿或图片时，只能替换已有窗口中的当前对象，无法利用现有贴靠能力进行目录整理、文稿对照或图片比较。

`ADR-0005` 曾决定在缺少明确场景时暂缓多窗口实例。现在共享桌面文件、文件打开方式、动态标题和贴靠窗口已经形成稳定基础，并出现以下明确场景：

- 同时浏览两个目录并在它们之间整理文件；
- 将两篇文稿左右贴靠进行对照；
- 同时查看两张图片；
- 在任务栏和 `Alt + Tab` 中按具体窗口切换工作对象。

本 Spec 重新评估 `ADR-0005` 的多实例部分；大型资源继续同源托管，不在本次范围内。

## 目标

建立 `WindowInstanceId` 驱动的窗口生命周期，在不改变桌面文件模型、存储格式和默认单例应用行为的前提下，让资源管理器、文件夹、记事本和照片查看器能够按明确规则打开多个独立窗口，并由任务栏、窗口预览、快捷键和跨应用启动统一管理。

## 非目标

- 不让所有应用默认支持多实例；
- 不为设置、日历、阅读器、照片实验室、画板、专注时钟、计算器或游戏开放多实例；
- 不允许同一个资源在同一应用中存在两个窗口实例；
- 不实现跨刷新恢复运行窗口，刷新后仍不自动打开任何应用；
- 不新增窗口标签页、虚拟桌面、窗口模板或会话保存；
- 不新增账号、云同步、远端持久化或后台任务；
- 不修改 `DesktopItem` 类型、IndexedDB 数据库结构、备份格式或资源缓存协议；
- 不在本 Spec 中扩展跨窗口拖放能力；
- 不改变大型资源的托管位置。

## 当前行为

### 窗口身份

- `WindowAppId` 同时承担应用类型和窗口实例身份；
- `WindowStateMap` 是 `Record<WindowAppId, WindowState>`；
- `focused` 只能是 `"desktop"` 或某个应用 ID；
- 关闭窗口只把对应应用的 `open` 设为 `false`。

### 应用宿主

- `DesktopRoot` 遍历 `REGISTERED_APPS`；
- 每个应用最多创建一个 `AppHost` 和一个 `WindowFrame`；
- 应用组件通过 `WindowRuntime` 查询应用级 active 状态和设置标题。

### 工作对象

- 当前文稿、图片、照片编辑源和文件夹由 `DesktopRoot` 中的单值状态保存；
- `WorkspaceRuntime` 向应用暴露这些应用级当前对象；
- `LaunchRuntime` 同一时间只保存一个待处理启动意图，不包含目标窗口实例。

### 桌面入口

- 应用图标、开始菜单和任务栏均按应用 ID 启动或恢复窗口；
- 任务栏一个应用只有一个预览和一组窗口命令；
- `Alt + Tab` 的每个条目对应一个应用；
- `WindowFrame` 使用 `nova-window-geometry:<appId>` 保存每个应用的最近窗口几何。

## 方案

### 术语

```ts
type WindowInstanceId = `${WindowAppId}:${string}`;

type WindowInstanceTarget =
  | { kind: "folder"; itemId: string }
  | { kind: "text"; itemId: string }
  | { kind: "image"; itemId: string };

type WindowInstance = {
  id: WindowInstanceId;
  app: WindowAppId;
  target?: WindowInstanceTarget;
  minimized: boolean;
  maximized: boolean;
  snapMode?: WindowSnapMode;
  z: number;
  title?: string;
  taskbarTitle?: string;
};
```

- `WindowAppId` 只表示应用类型；
- `WindowInstanceId` 使用 `${appId}:${token}` 格式表示一次运行中的窗口，并与 `"desktop"` 焦点值保持类型隔离；
- `WindowInstanceTarget` 表示该窗口绑定的桌面工作对象；
- 关闭窗口即移除对应实例，最小化仍保留实例及其应用内部状态。

实例 ID 仅用于当前页面会话，不写入用户文件、备份或跨刷新持久化数据。

### 实例策略

Manifest 增加可选的窗口实例策略：

```ts
window: {
  instancePolicy?: "singleton" | "multiple" | "per-resource";
}
```

- `singleton`：默认值，一个应用最多一个运行实例；
- `multiple`：只有用户执行“新建窗口”等显式命令时才创建新实例；
- `per-resource`：每个资源最多一个实例，打开相同资源时聚焦已有实例，打开不同资源时创建新实例。

首批策略：

| 应用 | 策略 | 说明 |
| --- | --- | --- |
| 文件资源管理器 | `multiple` | 支持显式新建资源管理器窗口，每个窗口维护独立位置和浏览历史 |
| 文件夹 | `per-resource` | 每个文件夹一个窗口，重复打开同一文件夹时聚焦已有窗口 |
| 记事本 | `per-resource` | 每篇文稿一个窗口，避免同一文稿并发编辑 |
| 照片 | `per-resource` | 每张图片一个查看窗口，支持并排比较 |
| 其他应用 | `singleton` | 保持现有行为 |

照片实验室继续保持单例，避免同时编辑同一来源图片时产生覆盖语义冲突。阅读器和游戏继续保持单例，避免重复加载大型内容或运行时。

### 用户可感知行为

#### 普通启动

- 单例应用的打开、恢复、最小化和关闭行为保持不变；
- 点击已有多实例应用的普通启动入口时，优先恢复并聚焦最近使用的实例；
- 没有运行实例时创建一个默认实例；
- 普通启动不会无提示地产生重复窗口。

#### 新建窗口

- 资源管理器的任务栏菜单和应用入口上下文菜单提供“新建窗口”；
- 新窗口从根目录打开，并拥有独立导航历史、搜索、排序、选择和窗口几何；
- `Ctrl/Command + N` 只在资源管理器聚焦时创建新的资源管理器窗口；
- `per-resource` 应用不提供空白重复窗口，窗口由具体文件或文件夹的打开动作创建。

#### 打开资源

- 打开不同文件夹、文稿或图片时，为对应资源创建窗口实例；
- 目标资源已有窗口时，恢复并聚焦该窗口，不创建重复实例；
- 目标应用只有一个未绑定资源的窗口时，首次打开资源复用并绑定该窗口；
- “打开方式”继续决定应用类型，实例策略只决定新建或复用哪个窗口；
- 从开始菜单搜索结果打开文件时遵循相同去重规则。

#### 窗口内切换资源

- 记事本侧栏、照片图库或文件夹内部发起的资源切换默认复用当前实例；
- 当前实例从资源 A 切换到资源 B 时，实例目标同步更新为资源 B；
- 如果资源 B 已由同一应用的其他实例打开，则聚焦该实例，当前实例继续保留资源 A；
- 新建文稿后，将创建结果绑定到发起操作的记事本实例；
- 以上规则保证同一应用内的 `app + target` 唯一，同时保留现有应用内导航习惯。

#### 任务栏与切换

- 任务栏仍按应用分组，不为每个实例增加独立固定图标；
- 只有一个实例时，点击、预览和上下文菜单保持现有行为；
- 存在多个实例时，任务栏预览列出各实例标题和运行状态；
- 选择预览项只恢复并聚焦对应实例；
- 应用组菜单提供“关闭所有窗口”；只有 `multiple` 应用提供“新建窗口”；
- `Alt + Tab` 按窗口实例和最近使用顺序切换，条目显示应用图标与实例标题。

#### 关闭与文件生命周期

- 关闭、最小化、最大化和贴靠只影响目标实例；
- 删除或移入回收站的文件、文件夹会关闭所有绑定该对象或其后代对象的窗口；
- 重命名文件后，对应实例标题立即更新；
- 清空回收站不会影响未绑定被删除对象的其他实例。

#### 移动端

- 紧凑视口继续采用全屏应用窗口；
- 移动端不显示“新建窗口”入口，不主动创建同一应用的并行窗口；
- 打开另一个同类型资源时，目标已有实例则聚焦该实例，否则复用当前实例并切换目标；
- 页面会话中从桌面宽度缩小到紧凑视口时，不销毁已经运行的实例，但同一时间只显示聚焦实例；最小化后可从任务栏实例列表切换；
- 桌面端创建的实例不会跨刷新恢复，移动端首次加载始终从无运行窗口状态开始。

### 技术设计

#### 窗口状态

- 将 `WindowStateMap` 替换为按 `WindowInstanceId` 管理的实例集合；
- `focused` 改为 `"desktop" | WindowInstanceId`；
- reducer 的打开、聚焦、关闭、最小化、最大化、贴靠和更新动作都显式携带实例 ID；
- 提供按应用查询实例、查找最近使用实例和按资源查找实例的纯函数；
- 关闭实例时从集合移除，不保留不可见的历史实例状态。

第一轮迁移期间，所有应用仍按 `singleton` 运行，以行为保持型测试证明实例模型没有改变现有产品行为。

#### 应用启动

窗口 Runtime 提供意图明确的命令：

```ts
openApp(app, options?)
openNewWindow(app)
openResource(app, target)
retargetInstance(instanceId, target)
focusInstance(instanceId)
closeInstance(instanceId)
closeAppInstances(app)
```

- `openApp` 遵循 Manifest 策略并默认复用；
- `openNewWindow` 仅允许 `multiple` 应用；
- `openResource` 对 `per-resource` 应用按 `app + target` 去重；
- `retargetInstance` 处理应用内部资源切换，并在目标已打开时返回已有实例；
- 不在各应用组件中重复实现实例选择逻辑。

#### 实例上下文

- `AppHost` 按运行实例渲染，不再按全部注册应用固定渲染；
- 每个 `AppHost` 为子树提供当前实例 ID、应用 ID 和目标资源；
- 动态窗口标题、active 判断和关闭订阅改为实例级；
- 保留应用级 `isAppActive(app)` 作为单例和游戏暂停逻辑的派生查询，不把它作为实例控制 API。

#### 启动意图

- `LaunchRuntime` 从单个全局意图改为实例可消费的启动目标；
- 创建或复用实例时，将目标绑定到确定的实例；
- 一个实例确认处理启动目标时，不影响其他实例；
- 不增加意图重试、超时或静默兜底。

#### 工作区状态

- `DesktopItem[]` 和文件命令继续由 `WorkspaceRuntime` 统一提供；
- 资源管理器的当前位置、历史、搜索、排序和选择保留在各组件实例内部；
- 文件夹、记事本和照片查看器从实例目标读取当前对象；
- 应用内部选择另一资源时通过实例 Runtime 更新目标，不在组件内维护第二份当前资源 ID；
- `DesktopRoot` 不再保存这些多实例应用的全局 `activeFolderId`、`activeNoteId` 和 `activeImageId`；
- 照片实验室继续使用单例 `photoSourceId`，不在本次迁移。

#### 窗口几何

- 几何状态继续由每个 `WindowFrame` 实例拥有；
- 现有 `nova-window-geometry:<appId>` 继续作为该应用新窗口的最近尺寸和位置模板；
- 新建第二个及后续窗口时在模板基础上做固定偏移，并经过现有边界约束；
- 自动实例偏移、贴靠和视口适配不回写应用级模板，只有用户拖动、缩放或居中窗口时更新模板；
- 不按随机实例 ID 写入永久 localStorage 键；
- 最大化、贴靠和系统全屏状态不跨刷新恢复。

### 数据与状态归属

- 数据所有者：桌面文件仍由 `DesktopRoot` 与 `WorkspaceRuntime` 统一管理；
- 窗口所有者：窗口实例集合由桌面外壳的 window reducer 管理；
- 实例内部状态：浏览历史、搜索、选择等由对应应用实例拥有；
- 状态生命周期：窗口创建时建立，关闭时销毁，最小化时保留，刷新时全部清空；
- 持久化位置：桌面文件继续使用 IndexedDB `nova-desktop`；仅保留应用级最近窗口几何 localStorage；
- 是否需要迁移：否，现有文件、设置、窗口几何和备份数据继续可用。

## 平台影响清单

| 检查项 | 是否涉及 | 说明 |
| --- | --- | --- |
| 应用注册与懒加载 | 是 | Manifest 增加实例策略，仍复用现有 loader |
| 窗口生命周期 | 是 | 从应用级状态改为实例级状态 |
| 文件类型与打开方式 | 是 | 打开方式结果增加实例选择与资源去重 |
| 跨应用启动或事件 | 是 | 启动目标绑定具体实例 |
| localStorage / IndexedDB | 是 | 不改数据结构；窗口几何保持应用级模板 |
| 备份、恢复与清理 | 否 | 不新增持久化数据，不升级备份格式 |
| Service Worker 与资源包 | 否 | 不改变缓存、预取或清理协议 |
| Worker / iframe | 否 | 首批多实例不包含 Worker 和 iframe 应用 |
| 离线行为 | 否 | 继续使用已缓存应用模块和本地文件 |
| 构建与部署 | 否 | 不新增依赖、资源或构建步骤 |

## 修改范围

### 计划修改

- `src/platform/apps/appManifest.ts`：声明实例策略；
- `src/platform/apps/appRegistry.ts`：派生默认策略和实例能力；
- `src/platform/windows/windowInstanceState.ts`：建立实例级 reducer 和查询函数，并取代旧 `windowState.ts`；
- `src/platform/windows/WindowRuntime.tsx`：提供实例级窗口命令与查询；
- `src/platform/launch/LaunchRuntime.tsx`：将启动目标绑定到窗口实例；
- `src/platform/workspace/WorkspaceRuntime.tsx`：移除已迁移应用的全局当前对象；
- `src/platform/apps/AppHost.tsx`：按实例渲染应用并提供实例上下文；
- `src/shell/DesktopRoot.tsx`：协调实例集合、资源打开和文件生命周期；
- `src/shell/WindowFrame.tsx`：使用实例 ID 处理几何、标题和关闭通知；
- `src/shell/DesktopTaskbar.tsx`：按应用分组并展示实例列表；
- `src/apps/explorer/entry.tsx`：支持独立资源管理器实例；
- `src/apps/folder/entry.tsx`：从实例目标读取文件夹；
- `src/apps/notes/entry.tsx`：从实例目标读取文稿；
- `src/apps/viewer/entry.tsx`：从实例目标读取图片；
- `tests/unit/`：增加实例 reducer、启动、任务栏分组、资源生命周期和架构契约测试。

### 不修改边界

- 保持 `DesktopItem` 为文件夹、文本和图片三种类型；
- 保持桌面文件只有 IndexedDB `nova-desktop` 一份持久化来源；
- 保持各应用模块按需加载，不因多实例预加载未打开应用；
- 保持 Service Worker 安装壳、资源包分类和缓存删除协议不变；
- 保持单例应用现有打开、暂停、关闭和存档语义；
- 保持刷新后所有应用关闭；
- 不新增兜底、自动重试、兼容分支或远端依赖；
- 不顺手重构应用视觉、文件命令或存储 Provider。

## 验收标准

- [x] AC-1：给定全部应用仍使用默认策略，当完成实例状态基础迁移时，现有单窗口行为和窗口快捷键保持不变；
- [x] AC-2：给定一个运行中的资源管理器，当用户执行“新建窗口”时，创建具有独立位置、历史、搜索和选择状态的新实例；
- [x] AC-3：给定两个不同文件夹、文稿或图片，当用户依次打开它们时，各自拥有可同时显示和贴靠的窗口；
- [x] AC-4：给定目标资源已有窗口，当再次打开相同资源时，只恢复并聚焦已有实例；
- [x] AC-5：给定用户在某个实例内切换资源，当目标未打开时复用当前实例，当目标已打开时聚焦已有实例；
- [x] AC-6：给定同一应用的多个实例，当最小化、关闭、最大化或贴靠其中一个时，其他实例状态不变；
- [x] AC-7：给定同一应用的多个实例，任务栏按应用分组显示实例预览，`Alt + Tab` 按窗口实例切换；
- [x] AC-8：给定绑定桌面文件的窗口，当文件被重命名时标题同步更新；当文件或其父目录被删除时，受影响实例关闭；
- [x] AC-9：给定单例应用，当用户重复启动时，不创建第二个实例；
- [x] AC-10：给定紧凑视口，当用户打开另一个同类型资源时，复用或聚焦现有实例，界面不出现“新建窗口”入口；
- [x] AC-11：给定桌面端已有多个实例后进入紧凑视口，当切换或最小化窗口时，不丢失其他运行实例且同时只显示一个全屏实例；
- [x] AC-12：刷新页面后不恢复任何窗口，桌面文件、设置、阅读进度和游戏存档保持不变；
- [x] AC-13：打开多个实例不会提前加载未打开应用，也不会新增 Service Worker 缓存条目类型；
- [ ] AC-14：TypeScript、相关单测和 diff 审计已通过；最短桌面浏览器关键路径待获准启动开发环境后执行。

## 验证计划

- TypeScript：`npx tsc --noEmit`
- 相关单测：
  - `tests/unit/windowInstanceState.test.ts`
  - `tests/unit/windowRuntime.test.ts`
  - `tests/unit/windowGeometry.test.ts`
  - `tests/unit/platformRuntimes.test.ts`
  - `tests/unit/appRegistry.test.ts`
  - `tests/unit/appComponents.test.ts`
  - `tests/unit/fileAssociations.test.ts`
  - `tests/unit/desktopFiles.test.ts`
  - 新增任务栏实例分组和资源实例生命周期测试
- 关键交互：
  - 新建两个资源管理器窗口并分别导航；
  - 打开两个文件夹并左右贴靠；
  - 打开两篇文稿和两张图片，验证相同资源去重；
  - 在记事本和照片窗口内部切换资源，验证当前实例复用和已有目标聚焦；
  - 从任务栏预览和 `Alt + Tab` 切换具体实例；
  - 最小化、关闭和删除绑定资源只影响目标实例；
  - 在移动端打开两个同类型资源，确认复用当前实例；
  - 刷新后确认所有窗口关闭且用户数据保留。
- 不执行的验证及原因：默认不运行 lint 或完整构建；在未获用户明确授权时不启动开发服务器，因此浏览器关键路径保留为最终人工验收项。

## 风险与迁移

- 已知风险：应用 ID 与实例 ID 混用会造成错误聚焦、关闭整个应用组或标题串写；
- 已知风险：实例目标与全局当前对象并存期间可能出现双重状态来源，迁移必须按应用一次完成；
- 已知风险：任务栏、快捷键、关闭通知和文件删除属于跨模块行为，需先建立纯函数测试再接入 UI；
- 已知风险：多个编辑类组件同时挂载会增加内存占用，因此首批不开放照片实验室、阅读器和游戏多实例；
- 数据迁移：无；继续读取现有应用级窗口几何键；
- 回滚方式：在用户数据结构不变的前提下，恢复应用级窗口 reducer、宿主循环和启动行为即可；
- ADR：已新增 `ADR-0006`，取代 `ADR-0005` 中“暂缓多窗口实例”的部分；其大型资源托管决策继续有效。

## 待确认项

- 无。

## 迭代拆分

1. **实例状态契约**：引入 `WindowInstanceId`、实例 reducer 和查询函数；所有应用仍按单例运行，不产生用户可感知变化。
2. **统一实例宿主**：让 `AppHost`、Window Runtime、Launch Runtime、`WindowFrame`、任务栏和 `Alt + Tab` 使用实例身份，继续验证单例行为等价。
3. **资源管理器与文件夹**：开放资源管理器显式新建窗口和文件夹按资源实例化，完成任务栏分组交互。
4. **文稿与图片查看**：开放文稿、图片按资源实例化，迁移对应 Workspace 当前对象并处理重命名、删除和回收站生命周期。
5. **验收与产品说明**：完成桌面和移动端最短关键路径验证，并同步 README 中的多窗口能力说明。

每次迭代只实现上述一个目标；行为保持型迁移和用户可感知功能不得合并提交。

## 后续事项

- 评估跨资源管理器窗口拖放；
- 评估照片实验室按图片实例化及编辑冲突规则；
- 评估文稿窗口的“在新窗口中打开”上下文命令；
- 评估会话恢复，但不得违背刷新后默认不自动打开应用的现行产品边界；
- 只有出现明确场景后，再评估阅读器或游戏多实例。

## 确认记录

- 2026-09-02：建立草稿。
- 2026-09-02：确认首批开放资源管理器、文件夹、记事本和照片查看器；移动端维持单实例体验；任务栏按应用分组；新增 ADR-0006 并部分取代 ADR-0005。
- 2026-09-02：AC-1 至 AC-13 完成实现、定向测试和静态审计；AC-14 的浏览器关键路径因未启动开发环境而待验收。
