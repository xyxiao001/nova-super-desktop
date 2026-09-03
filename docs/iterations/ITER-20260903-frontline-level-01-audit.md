# 前线第一关资源与行为审计

- 日期：2026-09-03
- 状态：进行中（LevelAssetManifest 已生成）
- 对应 Spec：`SPEC-20260903-frontline-faithful-battle.md`
- 关卡：`100101` / `desert-1` / `烈日沙漠1`

## 本轮目标

读取第一关实际使用的地图、单位、HUD 和音频资源，生成可重复验证的 `LevelAssetManifest`。本轮不开始战斗实现，不用文件名推测未确认的行为配置。

## 已确认资源

- `firstlv_*`：关卡配置 `100101`、四名基础英雄、沙漠 BGM；
- `map_bg_01_01_*`：原生 900×1600 第一关背景；
- `map_sprite_*`：部署石台、锁定位、选中圈和放置箭头；
- `char_monster_01_jiachong_*`：沙甲虫；
- `char_monster_01_xiyi_*`：沙漠蜥蜴；
- `char_monster_01_zongquan_*`：野狗；
- `gui_fight_*`、`gui_tex_fight_*`：暂停、倍速、统计、波次、技能、强化和召唤 HUD。

## 场景事实

- 单一路径，12 个路径点；
- 12 个塔位，其中 7 个可部署、5 个锁定；
- 玩家槽位世界坐标 `(-1.1, -5)`；
- 水晶世界坐标 `(0.1241378, -6.2355433)`；
- 相机正交高度为 8，每个世界单位对应 100 个逻辑像素；
- 第一关共 6 波，三星时间目标为 220 秒；
- 挑战面板展示四名英雄以及沙甲虫、沙漠蜥蜴、野狗；
- 玩家领主和主动技能由账号阵容决定，不属于第一关固定角色资源。

## 动画事实

- 四名英雄和三类敌人均为 Spine `4.2.33`；
- 四英雄均包含 `stand`、`run`、`attack_1`；
- 三类敌人均包含 `stand`、`run`、`attack_1`、`dead`；
- 七个骨骼的动画事件轨均为空；
- 两份英雄战斗事件二进制已导出并完成记录级解析：格式版本为 `2`，法师 12 条、炮手 23 条；
- 事件记录可确定变体 ID、动画名、触发帧、事件来源类型、事件类型、音效 ID 和参数；
- 法师基础 `attack_1` 在第 4 帧触发投射物事件，即 30fps 下约 `0.133333s`；
- 炮手变体 `101` 的 `virtual_attack_3` 在第 1 帧触发投射物事件，即约 `0.033333s`；
- 法师基础攻击投射物为 `Emiter_hero_eject_guangfa01_pugong.prefab`，碰撞特效为 `eff_Heros_mushi_SJ.prefab`，初速为 `10`；
- 炮手对应投射物为 `Emiter_hero_eject_haidao_big.prefab`，碰撞特效为 `eff_Heros_haidao_sj.prefab`，初速为 `5`，抛物线高度为 `3`。

## 运行时波次证据

- `2026-09-03 19:33` 首次实测中，第 2 至第 6 波分别在开战后约 `10.5s`、`25.0s`、`38.1s`、`66.0s`、`109.7s` 切换；期间包含选卡和手动暂停。
- `2026-09-03 21:41` 第二次实测中，第 2 至第 6 波分别在开战后约 `11.5s`、`23.8s`、`35.1s`、`57.6s`、`80.3s` 切换。
- 日志明确显示提前切波由“剩余怪低于阈值”触发，因此这些时间是战斗结果证据，不等同于静态最大等待时间。

## RKT 与 DBC 配置证据

- RKT 固定头为 `rkt\0` 加一个小端边界值；当前三个已验证容器的边界均为 `0x4008`。
- 去除 8 字节 RKT 头后，先有 8 字节私有前导和 `16384` 字节独立保护区；从负载偏移 `0x4008` 开始循环 XOR `8a 7b a4 d2` 后恢复为标准 ZIP 尾段。
- Boot RKT 恢复出 17 个条目，其中 16 个可直接读取；Lua RKT 恢复出 2722 个条目，其中 2713 个可直接读取。
- Boot 内的 `BinaryAssets/CSV.zip` 是同结构的嵌套 RKT，恢复出 490 张配置表，其中 487 张可直接读取。
- DBC `1000` 格式由 108 字节头、字段描述、固定宽度行区、数值字典池和 7-bit 长度字符串池组成。
- `100101` 在 `EctypeWave.csv` 中有 6 条波次记录，在 `ectype_spawn_monster_info_c.csv` 中对应 ID `253..270` 的 18 条刷怪记录。
- 六波怪物总数依次为 `8 / 12 / 12 / 20 / 21 / 56`；最大等待时间依次为 `0 / 20 / 25 / 30 / 40 / 40` 秒。
- 第五波包含 1 只 `3001 沙漠蜥蜴精英` 并启用 `bossEffect=2`；它不是挑战面板中的独立 Boss 卡。
- 普通怪物映射为 `1001 沙漠蜥蜴`、`1002 野狗`、`1003 沙甲虫`。

## 产物

- `scripts/frontline/audit_level_01.py`
- `scripts/frontline/rkt_formats.py`
- `scripts/frontline/inspect-level-spine.mjs`
- `docs/reverse-engineering/frontline-rkt/`
- `public/assets/games/frontline/levels/desert-1/manifest.json`
- `public/assets/games/frontline/levels/desert-1/source-100101.json`
- `public/assets/games/frontline/levels/desert-1/wave-config.json`
- `public/assets/games/frontline/maps/desert-1.png`
- `public/assets/games/frontline/spine/<actor>/`
- `public/assets/games/frontline/sprites/map-common/`
- `public/assets/games/frontline/audio/main-bgm-desert.m4a`

重复生成命令：

```bash
FRONTLINE_ASSET_ROOT="<TJCS 缓存根目录>" npm run frontline:audit-level-01
```

本轮选择性导出约 6.4MB，没有复制完整游戏缓存。

## 当前阻塞

- RKT 的 8 字节私有前导之后有 `16384` 字节保护区，其算法和 key/IV 尚未恢复；不影响第一关波次表，但仍阻塞位于每个 ZIP 首部的条目；
- Spine 没有命中事件；法师和炮手的外部事件触发帧已解析，骑士和射手仍需配置或逐帧标定；
- 英雄投射物与命中特效路径及参数已经解析，但尚未完成 Bundle 对象归属；
- 怪物受击材质/命中特效尚未完成现场逐帧归因；
- 第一关参考账号的领主与主动技能需要锁定。

上述项目均在 Manifest 的 `unresolved` 中显式记录。当前可进入基于已确认数据的正式战斗切片，但在阻塞解除前不得宣称第一关整关复刻完成。

## 验证

- [x] 固定版本审计脚本可重复生成相同 Manifest（SHA-256：`c4a3dfad905c5cebf4ab38c77e443e49f936ac332f357a0f6ff970939bbde029`）
- [x] 波次配置 SHA-256：`73e8b14d27ff4f44ca1f4c81c8c3960db92fa13bf0e84d9ad6fd103419349bbf`
- [x] TypeScript 检查通过
- [x] LevelAssetManifest 资源契约测试通过
- [x] 既有前线资源和核心测试通过，共 3 个测试文件、18 项测试
- [x] `git diff --check` 通过
- [x] 未运行 lint
- [x] 未运行完整构建
