# SPEC-20260828：P2 应用 CSS 与资源包配置

- 状态：已完成
- 提出日期：2026-08-28
- 负责人：Codex
- 相关 ADR：`docs/adrs/ADR-0003-lazy-css-resource-manifest.md`

## 背景

`desktop.css` 同时承载桌面外壳和应用样式，所有应用 CSS 会随桌面启动加载。资源包展示清单与 Service Worker 匹配清单分别维护，新增大型资源需要重复接线。

## 目标

将应用样式从桌面外壳拆出并跟随懒加载应用进入；在 App Manifest 模块统一声明资源包元数据与匹配规则，并生成 Service Worker 配置。

## 非目标

- 不修改任何界面、窗口尺寸、响应式规则或动画效果；
- 不修改缓存包 ID、匹配顺序、缓存策略、版本号或清理语义；
- 不修改应用 loader、Runtime、存储与备份；
- 不引入新的资源预取、重试、降级或远端配置。

## 方案

1. 保留 `desktop.css` 作为桌面外壳样式；文件类应用、游戏与工具、阅读器分别由懒加载模块导入自己的 CSS 分片。
2. `appManifest.ts` 声明资源包展示元数据、匹配字段及应用与专属资源包关系。
3. 设置页资源统计从 Manifest 派生展示目录。
4. 构建前运行生成脚本，输出 `public/resource-packages.generated.js`；Service Worker 只消费生成结果。

## 修改范围

### 计划修改

- `app/desktop.css`、应用 CSS 文件及对应应用入口；
- `app/appManifest.ts`、`app/resourceCache.ts`；
- `scripts/generate-resource-packages.mjs`、生成配置、`public/sw.js`；
- `package.json`、相关测试和本阶段文档。

### 不修改边界

- 保持用户可感知行为与现有缓存分类完全一致；
- 不新增兼容分支、校验、兜底或错误提示；
- 不运行 lint 或完整构建。

## 验收标准

- [x] AC-1：桌面启动入口不再全局导入阅读器和应用主体样式；
- [x] AC-2：外壳、文件类应用、游戏与工具、阅读器样式边界明确；
- [x] AC-3：资源包展示目录和 SW 匹配配置均从 Manifest 派生；
- [x] AC-4：生成结果与仓库文件一致，缓存 ID 与匹配语义保持不变；
- [x] AC-5：TypeScript、相关单测和全部单测通过。

## 验证计划

- `npm run resources:config` 后检查生成文件无 diff；
- `npx tsc --noEmit`；
- Manifest、资源包相关单测与 `npm test`；
- `git diff --check`；不运行 lint 或完整构建。

## 迭代拆分

1. 拆分应用 CSS 并迁移导入边界；
2. Manifest 派生资源包配置并生成 SW 输入。

## 确认记录

- 2026-08-28：用户授权按 P0→P3 路线自动迭代；本阶段不改变产品能力。
