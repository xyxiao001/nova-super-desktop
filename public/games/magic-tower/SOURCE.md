# 魔塔集成说明

## 游戏来源

- 作品：`HumanBreak`（《人类：开天辟地》）
- 上游仓库：https://github.com/unanmed/HumanBreak
- 发布分支：`gh-pages`
- 固定提交：`57b9b4dc2c95f3b9db79f3cf61e576564b695b48`
- 许可证：MIT，原文保存在本目录的 `LICENSE`

当前导入内容包含完整发布运行时、77 个楼层文件、章节切换存档、剧情、技能树、商店、Boss、图片、字体、音乐和音效。`maps/` 地图预览、Git 历史、开发服务及编辑器未导入。

## NOVA 适配

1. 发布路径由 `/HumanBreak/` 改为 `/games/magic-tower/`。
2. `nova-bridge.js` 负责窗口激活、重开、进度和结局消息。
3. 仅允许同源资源请求；开局统计、成绩上传、在线评论、工程下载和开发热更新 WebSocket 均已禁用。
4. 游戏资源按需加载，不加入 PWA 首屏缓存。
5. 游戏原生存档由 `localforage` 存入浏览器 IndexedDB，并以 `HumanBreak` 为键名前缀。
