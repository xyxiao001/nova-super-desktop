# Frontline RKT / DBC 逆向记录

本目录记录《王国大作战：前线》固定参考版本的数据容器研究，作为后续逐关资源审计与配置提取的长期依据。

## 固定参考版本

- 资源版本：`412f11e3c27d645ddeafcf921f558d57`
- Unity/Tuanjie：`2022.3.48t7`
- Boot RKT SHA-256：`e57d37860136a649a521f007c2ec1d1f28e656013dc035a082a9abfc133d1688`
- 嵌套 CSV RKT SHA-256：`326acbd88696cc48944568df816fd6865ff5fa1e88eada2b709589470f6ed555`

## 文档

- [RKT 容器格式](./RKT_FORMAT.md)
- [DBC 1000 表格式](./DBC_FORMAT.md)
- [第一关 100101 配置证据](./LEVEL_100101.md)

## 实现

- `scripts/frontline/rkt_formats.py`
  - 恢复 RKT 可读尾段；
  - 从 ZIP 中读取不与受保护首段相交的条目；
  - 解码 DBC `1000` 的数值、布尔和字符串字段。
- `scripts/frontline/audit_level_01.py`
  - 校验固定 Boot RKT 哈希；
  - 递归读取 `BinaryAssets/CSV.zip`；
  - 提取 `EctypeWave.csv`、`ectype_spawn_monster_info_c.csv`、`Monster.csv`；
  - 生成第一关 `wave-config.json` 和 `LevelAssetManifest`。

## 可重复执行

```bash
FRONTLINE_ASSET_ROOT="<TJCS 缓存根目录>" npm run frontline:audit-level-01
```

当前正式输出：

- `public/assets/games/frontline/levels/desert-1/wave-config.json`
- `public/assets/games/frontline/levels/desert-1/manifest.json`

## 证据等级

- `confirmed`：由多个源文件、ZIP 校验或运行行为交叉验证。
- `inferred`：结构吻合，但尚未取得实现代码或完整解密结果。
- `unknown`：仍需静态分析或运行时取证。

不得将 `inferred` 或 `unknown` 结论写成运行时业务常量。
