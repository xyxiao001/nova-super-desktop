# RKT 容器格式

## 已确认布局

| 绝对偏移 | 大小 | 含义 | 状态 |
|---|---:|---|---|
| `0x0000` | 4 | 魔数 `72 6b 74 00`，即 `rkt\0` | confirmed |
| `0x0004` | 4 | 小端负载内尾段偏移，当前样本均为 `0x4008` | inferred |
| `0x0008` | 8 | ZIP 负载私有前导；三个样本完全相同 | confirmed |
| `0x0010` | 16384 | 独立保护区 | inferred |
| `0x4010` | 至 EOF | 循环 XOR 尾段 | inferred |

尾段转换：

```text
plain[i] = encoded[i] XOR key[i mod 4]
key = 8a 7b a4 d2
```

这里的 `i` 从去除 8 字节 RKT 头后的 ZIP 负载起点计算。头部值 `0x4008` 作为负载内偏移时，对应 8 字节私有前导加 `ENCRYPT_LENGTH=16384`；因此尾段的绝对文件偏移为 `0x4010`。由于两个偏移均能被 4 整除，此修正不改变后续条目的 XOR key 相位。

转换完成后，尾段可验证出标准 ZIP：

- local file header：`PK 03 04`
- central directory：`PK 01 02`
- end of central directory：`PK 05 06`

ZIP 中央目录记录的首个 local header 偏移为 8，说明 ZIP 负载内部另有 8 字节私有前导。

## 已验证样本

| 容器 | ZIP 条目 | 首段外可读条目 |
|---|---:|---:|
| `Boot_412f11e3c27d645ddeafcf921f558d57.zip` | 17 | 16 |
| `Lua_412f11e3c27d645ddeafcf921f558d57.zip` | 2722 | 2713 |
| Boot 内 `BinaryAssets/CSV.zip` | 490 | 487 |

只要条目的 local header 位于负载偏移 `>= 16392`，Python `zipfile` 即可正常校验 CRC 并解压。

## 首段现状

8 字节私有前导后的 16384 字节不是尾段 XOR：

- 对整个负载执行尾段 XOR 后，首段保持高熵且首个 local header 无法读取；
- Boot、Lua、CSV 三个容器的首个 8 字节负载完全相同，后续区域则接近满熵且没有重复 8 字节块；
- 三者第二个 8 字节块不同，而中央目录表明该处应从标准 ZIP local header 开始；
- metadata 中 741 个可打印 8 字节字符串均不能作为直接 DES ECB/CBC key 解出该已知明文；
- `18012618`、`ADDJIEMI` 及其 MD5/SHA 派生前 8 字节也不匹配；
- 838 个可打印 16/24/32 字节 metadata 候选与 450 个 IV 候选均不能作为 AES ECB/CBC 参数同时解出三个容器的精确 ZIP local header；
- 文件名、首条目名、版本哈希及其常见 MD5/SHA 派生组合也不匹配；
- 简单的每容器循环 XOR 只能构造首个 ZIP 头，无法通过文件名或 CRC 校验。

因此目前只能确认首段使用独立、按容器变化的保护过程。`RktMainCfg.LoadDesKey`、`LuaDesKey`、`LuaDesIV` 和 `rktLuaFileProc_Zip` 仍是后续定位目标。

## 已排除的静态路径

- `data.tj3d` 中存在 `RktMainCfg`、`rktLuaFileProc_Zip`、`LauncherWebGLBootZip`、`CsvParser` 等 MonoScript 定义，但没有序列化的 `RktMainCfg` MonoBehaviour 实例，无法从对象字段直接读取 key/IV。
- 客户端使用 Tuanjie metadata v32 和两个 Wasm code split；标准 Il2CppDumper 及当前 `il2cpp-dumper-rs` 会在注册表或压缩索引解析阶段停滞。
- 直接把 metadata 版本改写为 v31 会破坏表结构，不能作为有效分析结果。
- `Lua_CeHua/JiaMiKey.lua` 是战斗数值防作弊字段配置，与 RKT 文件保护 key 无关。

## 安全边界

- 提取器只读取原缓存，不原地修改文件。
- 未解出的首段保持原字节，不输出伪造明文。
- 对 local header 位于受保护区内的条目直接报错。
- 每个输入容器必须先校验固定版本 SHA-256。
