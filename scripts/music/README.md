# 本地音乐资源准备

本目录用于在开发电脑上匹配逐字歌词并生成 Cloudflare Pages 静态资源，不随 NOVA 页面运行，不要求访问者连接本地服务。

依赖 Node.js 22.13+、Python 3；压缩音频另外需要 `ffmpeg` 在 PATH 中。

## 歌词服务

运行 `npm run lyrics:serve`，固定监听 `127.0.0.1:3310`：

- `GET /search?title=歌名`：网易云候选，仅使用歌名查询。
- `GET /lyrics?id=歌曲ID`：网易云原始 YRC，没有逐字版本则返回 `null`。
- `POST /match`：请求体 `{ "title": "歌名", "artist": "歌手", "duration": 250 }`，按原唱和音频时长匹配网易云逐字歌词。
- `POST /match?source=qq`：相同请求体，明确选择 QQ 音乐逐字歌词。

服务不自动重试或跨来源回退，不使用账号 Cookie，不将普通逐行歌词伪装成逐字歌词。接口异常返回错误；找不到对应逐字歌词返回 `null`。本地已有逐字 LRC 可以直接用于准备清单。

## 生成静态曲库

```sh
npm run music:prepare -- /absolute/path/inventory.json /absolute/path/matches /absolute/path/music
```

`inventory.json` 为歌曲数组，每项包含 `id`、`file`（源音频绝对路径）、`title`、`artist`、`album`、`duration`（秒）。`matches/0.json` 等文件与清单序号对应，结构为 `{ "match": { "source": "netease|qq|local", "song": { "id": 123, "duration": 250 }, "lyrics": "原始逐字歌词" } }`。

输出包含 192 kbps MP3、封面、增强 LRC 和 `catalog.json`。歌词保留逐字起止毫秒时间；网易云的 JSON 制作信息不进入歌词正文。音频源文件不会修改。上一级目录生成来源与时长报告 `music-preparation-report.json`。

将生成的 `music/` 与完整 `books/` 一起上传到 Pages 项目 `nova-books`。只上传静态资源目录和 `_headers`，不要上传原始音频、准备清单或本地服务。

## 来源

网易云和 QQ 请求协议参考 [LDDC](https://github.com/chenmozhijin/LDDC/tree/84631e8cd011fcc3f71ca0ae017e2c9758958ffc)。`vendor/tripledes.py` 源自该提交的 `LDDC/core/decryptor/tripledes.py`，作者及 GPL-3.0-only 声明保留；唯一改动是将 LDDC 缓存替换为 Python 标准库 `lru_cache`。`vendor/decrypt-qrc.py` 为独立 GPL 命令行桥接程序，通过标准输入输出被 Node 调用，许可证见 `vendor/COPYING`。
