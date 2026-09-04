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
| 14 | int64 池偏移 |
| 15 | int64 池长度 |
| 16 | int64 池数量 |
| 20 | list 池偏移 |
| 21 | list 池长度 |
| 22 | list 数量 |

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

- `0x20`：行内值是 list 池索引；
- `0x40`：行内值是数值字典索引；
- `0x80`：字段参与主键；
- 全 1 行内值是 null sentinel。

已确认值类型：

- `0`：布尔值；
- `1`：整数；
- `2`：int64；
- `4`：字符串池索引；
- `5`：资源路径字符串池索引。

当 `value_type=2` 且存在 `0x40` 标志时，索引目标是 int64 池，不是普通数值字典。
`0x20` 的优先级高于 `0x40`；两者同时出现的字段仍按 list 池读取。

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

## int64 池

```text
repeat int64PoolCount:
  uint32 valueOffset
  uint32 valueCount
int64Data...
```

每项为 little-endian 有符号 64 位整数。`MonsterLevelProp_C.csv` 的 `lHP`
通过该池存储；把它当普通 dictionary 会得到错误索引或越界。

## list 池

```text
uint32 listCount
repeat listCount:
  uint32 valueOffset
  uint32 valueCount
listData...
```

列表描述符不携带元素宽度。当前解析器使用相邻非空列表的偏移差和元素数量推导宽度，
已验证支持 1、2、4、8 字节有符号整数。`EctypeWave.monsterPropRatios`
和 `Skill.RangeValue` 都由该池提供，因此不能固定按 int64 解码。

## 字符串池

字符串按 .NET 风格 7-bit encoded length 加 UTF-8 内容连续存储。解析数量必须与头部 `stringCount` 相等。

## 已验证表

| 表 | 行数 | 行宽 | 字段 |
|---|---:|---:|---:|
| `EctypeWave.csv` | 5672 | 22 | 20 |
| `ectype_spawn_monster_info_c.csv` | 29487 | 18 | 15 |
| `Monster.csv` | 413 | 41 | 36 |
| `MonsterLevelProp_C.csv` | 123601 | 18 | 14 |
| `Skill.csv` | 621 | 55 | 48 |

这些表均由 `scripts/frontline/rkt_formats.py::decode_dbc` 解码，并由第一关资源契约测试验证关键结果。
