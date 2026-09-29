# ITER-20260929：四个独立听歌空间

- 状态：已完成
- Spec：`docs/specs/SPEC-20260929-listening-places-redesign.md`
- 设计稿及自审：`docs/designs/music-places/`

## 结果

保留夜场演唱会，重做海上列车、雨巷咖啡、黑胶档案、月面电台。先完成 HTML/SVG 设计稿并渲染自审，再实现独立的场景构图和 Three.js 程序材质/模型。删除原来的天台选项，共五个可选场景。

场景使用原有歌词时序和音频 analyser。Three.js 在新场景打开时懒加载，不下载外部贴图，不增加依赖。组件退出时销毁几何、材质、纹理、阴影与 WebGL 上下文。

## 验收

- TypeScript：`npx tsc --noEmit --incremental false` 通过。
- musicPerformance、musicPlaces、musicConcert、musicSharing、musicShow 共 5 个文件、24 项相关测试通过。覆盖五场景注册、逐字歌词、长标题、分享字段、几何相机、运动对象与资源释放。
- 隔离 Chromium 中通过曲库夹具直接进入舞台，依次切换五场景，未改真实用户数据。
- 1440×1000 桌面、390×844 手机实际截图检查；长歌名全文显示、主体可辨、无横向溢出。
- 实际播放时 WebGL 绘制计数增加；暂停、减少动态、最小化后计数停止；控制台无 shader/WebGL 错误，无 pageerror。
- 验证机位与灯色更新、保存到歌曲，以及分享 URL 往返得到相同 scene/camera/palette。
- 首次视觉检查未通过的月面构图、唱片摩尔纹、手机太阳位置和长标题样式优先级已修正，并重新检查对应截图。
- `git diff --check` 通过；ConcertStage.tsx 与 concert.css 无差异；没有 lint、完整构建或手动发布。用户后续授权提交推送，Service Worker 版本升至 v53，版本断言同步更新。

## 边界

音效、歌曲下载、歌词获取、续听和桌面窗口管理未修改。旧天台记录不迁移、不自动映射，用户可在地点选择器重新选择。新场景依赖 WebGL，不新增备用渲染器。浏览器脚本和验收截图在 `/tmp`，不纳入仓库。
