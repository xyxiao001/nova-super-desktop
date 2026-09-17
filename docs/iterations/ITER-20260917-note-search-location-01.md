# ITER-20260917：全局搜索直达文稿命中位置

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260917-note-search-location.md`
- 对应验收项：AC-1 至 AC-5
- 开始日期：2026-09-17
- 完成日期：2026-09-17

## 本轮目标

让正文搜索结果展示真实命中片段，并直接打开文稿、选中首个匹配文字。

## 本轮不做

不新增搜索索引、持久化、模糊搜索、相关性排序、书籍正文搜索、图片 OCR、Markdown 或 AI。

## 实现记录

- `app/textSearch.ts`：以原始正文计算首个不区分大小写的精确匹配范围，并生成折叠空白、有限上下文的片段。
- `app/appLaunch.ts`：为记事本增加一次性文本定位意图。
- `DesktopRoot`：文本结果直接打开 notes 的资源窗口；正文命中展示片段并传递范围，名称单独命中只打开文稿。
- 记事本：目标文稿渲染后聚焦 textarea、选中匹配范围并滚动到近似位置，再确认本次启动意图。

## 验证结果

- `npx tsc --noEmit --incremental false`：通过。
- `npm run test:unit -- tests/unit/textSearch.test.ts tests/unit/noteSaveStatus.test.ts tests/unit/platformRuntimes.test.ts tests/unit/windowInstanceState.test.ts tests/unit/appComponents.test.ts`：5 个测试文件、25 项测试全部通过。
- 浏览器隔离来源：全局搜索“摘录回链”显示正文片段；点击结果打开来源摘录文稿，并选中正文中的“摘录回链”；控制台无运行错误。
- `git diff --check`：通过；本地服务 HTTP 200。
- 未运行 lint 或完整构建；未提交、推送或发布。

## 未实现能力

- 仅定位第一处正文命中，没有上一处/下一处导航。
- 文件名命中不生成正文选区。
- 未对超大工作区建立离线索引或 Worker；仍沿用当前内存扫描。
