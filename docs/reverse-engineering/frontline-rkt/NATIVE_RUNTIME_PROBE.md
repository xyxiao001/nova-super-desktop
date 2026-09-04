# 原版运行时本地验证（2026-09-04）

目标：确认能否直接复用原版 WASM 触发攻击。结果：尚未触发原版攻击；标准浏览器能编译两段 WASM，但框架启动被微信 SDK 依赖阻断。不能据此宣称完整运行时可用或不可用。

## 已验证

- 原始包来自本机已解包的 `/tmp/frontline-wxapp`，没有修改原始包。
- 主模块 `2ef94219ebac60f3.webgl.wasm.code.unityweb.wasm` 为 17,301,597 字节；第二段同名模块为 34,731,494 字节。
- Chrome 的 `WebAssembly.compileStreaming` 成功编译两段模块。主模块有 691 个导出，第二段无导出，通过共享函数表连接主模块。
- 主模块没有以 attack / skill / fight / lua 命名的独立导出。存在 `main`、`SendMessage` 等入口；不能当成单独的攻击函数直接调用。
- 原版 Emscripten 框架工厂成功加载；提供 `preRun: []` 后，框架组装导入接口时读取 `window.WXWASMSDK._JS_MobileKeybard_GetIgnoreBlurEvent` 失败。浏览器错误为 `Cannot read properties of undefined (reading '_JS_MobileKeybard_GetIgnoreBlurEvent')`。
- `instantiateWasm` 回调尚未到达。因此尚未验证主/副模块实例化、资源预载、引擎初始化、场景或攻击。

## 依赖证据

原版 `game.js` 使用 `requirePlugin("UnityPlugin", ...)` 启动 UnityManager；配置指定 UnityPlugin 1.2.91。框架为团结引擎 2022.3.48t7，引用 `WXWASMSDK`、微信文件系统及管理器。包内有 `unity-sdk/index.js` 和 `unity-sdk/mobileKeyboard/index.js` 等桥接源码；这些源码仍依赖微信宿主接口，不能把发现桥接文件等同于浏览器可直接运行。

原版 `wasm-split.js` / `import-func-index.js` 指定共享表大小 144093、三个可变 i32 全局、`initGlobal` 初始化和第二段共享内存协议。探针据此写出连接回调，但本次失败发生在回调之前；连接代码仍未验证。

## 复现

```sh
node scripts/frontline/runtime-probe/server.mjs /tmp/frontline-wxapp
```

打开 `http://127.0.0.1:4179/` 查看日志。探针只监听本机，按指定路径读取原版文件，不把原始包复制进产品资源。页面只允许同源网络请求，不执行游戏入口或账号 SDK。仅为设备标识、Web Audio 和日志提供真实浏览器实现；未实现的微信接口保持缺失，没有伪造成功响应。停止服务可在运行终端按 Ctrl+C。

## 对复刻路线的影响

1. **原版 WASM 直接驱动攻击：尚不可用。** 需要进一步移植平台桥接、资源加载和引擎启动，之后才有条件验证战斗。它不是一个可独立调用的攻击库。
2. **按原版 Lua 和配置移植战斗：可以继续推进。** 现有解包资料提供战斗逻辑、技能参数和动画资源；涉及 `rkt.EventBridge` 的引擎行为仍需对应实现与实测核对，不能仅靠 Lua 文本保证完全一致。

建议先按第二条推进首关，优先核对攻击距离、动作出手点、命中与冷却时序，再决定是否投入完整运行时移植。本轮未修改现有复刻战斗代码。
