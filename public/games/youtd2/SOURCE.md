# YouTD 2 Web 资源说明

## 游戏来源

- 作品：`YouTD 2`
- 官方页面：https://praytic.itch.io/youtd2
- 上游仓库：https://github.com/Praytic/youtd2
- Web 构建：https://html.itch.zone/html/18203777/index.html
- 下载日期：2026-09-01
- 下载时上游 HEAD：`d7532f35fe24d6f572348530f66f7a6421afe193`

当前目录保存官方 Godot Web 导出的 HTML、JavaScript、WebAssembly、PCK
游戏包、图标和加载画面。`index.pck` 的 SHA-256 为
`d03f0e4fc3dece0beb28490c24264bc595b8818be09f62348c789a24bbe8284b`。
线程动态库 `index.side.wasm` 的 SHA-256 为
`5bb72dbc5a74768f131b25249b1bf5665df08fdbb4511d0cb273b92cdac20cdc`。
音频工作线程 `index.audio.worklet.js` 的 SHA-256 为
`5b476a9c9ce642c0ee4256436d1bc31d9c38f868aca0f9a8e2a57c18d2dec2a3`。

## 许可证

- 源代码采用 MIT 许可证，原文保存在本目录的 `LICENSE`。
- 上游声明游戏素材采用 CC BY-NC 4.0：
  https://creativecommons.org/licenses/by-nc/4.0/
- 游戏包内还包含各素材作者和第三方许可证的完整署名信息。

## NOVA 适配

1. 移除了 itch.io 注入的 `htmlgame.js`。
2. 移除了 Sentry SDK、错误上报和性能追踪。
3. 游戏运行文件保持官方 Web 构建原样，使用相对路径从本目录加载。
4. `index.html` 提供 NOVA 窗口握手、激活和失焦桥接。
5. 游戏作为独立懒加载窗口接入，资源归入 `youtd2` 按需缓存包。
6. Godot `/userfs` IndexedDB 存档由 NOVA 游戏数据备份、恢复和清理流程管理。
