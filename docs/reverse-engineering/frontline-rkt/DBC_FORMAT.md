# DBC 1000 表格式

## 文件头

- 魔数：`DBC\n1000`
- 固定头大小：108 字节
- 从偏移 8 开始读取 25 个 little-endian `uint32`

当前提取器使用的字段：

| 索引 | 含义 |
|---:|---|
| 1 | 字段描述区偏移 |
| 2 | 字段描述区长度 |
| 3 | 固定宽度行区偏移 |
| 4 | 固定宽度行区长度 |
| 5 | 数值字典池偏移 |
| 6 | 数值字典池长度 |
| 7 | 字符串池偏移 |
| 8 | 字符串池长度 |
| 9 | 字符串数量 |
| 10 | 数值字典数量 |
| 11 | 字段数量 |
| 12 | 行数 |
| 13 | 单行字节数 |

必须满足：

```text
rowDataOffset = fieldSchemaOffset + fieldSchemaLength
rowDataLength = rowCount * rowSize
```

## 字段描述

每个字段依次包含：

1. 1 字节长度和 UTF-8 源字段名；
2. 1 字节长度和 UTF-8 输出字段名；
3. 8 字节描述符。

描述符：

| 字节 | 含义 |
|---:|---|
| 0 | 值类型 |
| 1 | 标志位 |
| 2 | 固定行内字节偏移 |
| 3 | 位宽编码：`0x20/0x40/0x80` 对应 `1/2/4` 字节 |
| 4..7 | little-endian 数值字典索引 |

已确认标志：

- `0x40`：行内值是数值字典索引；
- `0x80`：字段参与主键；
- 全 1 行内值是 null sentinel。

已确认值类型：

- `0`：布尔值；
- `1`：整数；
- `4`：字符串池索引；
- `5`：资源路径字符串池索引。

列表等复合类型暂不由通用提取器展开。

## 数值字典池

```text
uint32 dictionaryCount
repeat dictionaryCount:
  uint32 valueOffset
  uint32 valueCount
  uint8  valueWidth
dictionaryData...
```

`valueOffset` 相对于所有字典描述符之后的数据起点。`valueWidth` 已验证为 1、2 或 4；4 字节值按有符号整数解释，以保留 `-1`、`-2000` 等配置。

## 字符串池

字符串按 .NET 风格 7-bit encoded length 加 UTF-8 内容连续存储。解析数量必须与头部 `stringCount` 相等。

## 已验证表

| 表 | 行数 | 行宽 | 字段 |
|---|---:|---:|---:|
| `EctypeWave.csv` | 5672 | 22 | 20 |
| `ectype_spawn_monster_info_c.csv` | 29487 | 18 | 15 |
| `Monster.csv` | 413 | 41 | 36 |

三张表均由 `scripts/frontline/rkt_formats.py::decode_dbc` 解码，并由第一关资源契约测试验证关键结果。
