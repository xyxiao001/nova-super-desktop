# 第一关攻击证据：四英雄与沙王

- 资源版本：`412f11e3c27d645ddeafcf921f558d57`
- 关卡：`100101` / `desert-1` / 烈日沙漠1
- 单位：闪电丘，`heroID=30001`，普通技能 `SkillID=30001`
- 记录日期：2026-09-04
- 当前阶段：A0 已完成；四英雄、精灵大师召唤物与沙王的首轮静态攻击矩阵已完成；已接入三名远程英雄的确认发射时序、怪物模型半径索敌、精灵大师召唤生命周期和沙王双段命中。弹体推进/碰撞与召唤物自主战斗仍被原生 C# 行为和动态样本证据缺口阻塞。

## 样本 LGT-001：普通攻击静态时间线

### 环境

- 原客户端资源版本如上，参考画面为用户提供的
  `codex-clipboard-9144da01-3a0c-4888-8326-32fc5d77794e.gif`。
- GIF SHA-256：`5aee2bb5ecd0ffe53191f8844dffa297be8d754f4752b1a50be855f0d037a440`。
- GIF 为 `912×1620`、380 帧、31.6 秒，平均约 12fps；画面存在多个英雄同时攻击，
  因而只用于确认场景、单位和可见表现，不能用其中的飘字反推闪电丘单次命中帧。
- x1 倍速可见；账号等级、装备、局内强化和英雄合成阶无法从该片段可靠锁定。

### 静态证据

| 来源 | 字段 / 对象 | 值 | 判定 |
| --- | --- | --- | --- |
| `hero_pikaqiu.bytes` | `attack_1` 战斗事件 | `variantId=100`、第7帧、`eventType=27` | confirmed |
| `hero_pikaqiu.bytes` | 发射参数 | `initSpeed=10`、`maxFlyDis=90`、`maxFlyTime=3000`、`lockTarget=False` | confirmed |
| `hero_pikaqiu.bytes` | 发射偏移 | `SkillOffset=0.2,0.6` | confirmed |
| `hero_pikaqiu.bytes` | 发射资源 | `Emiter_hero_shandianqiu_zidan1.prefab` | confirmed |
| `Skill.csv` 30001 | `ShowID=30001`、`ShowArgs=segment_hit_1_1`、`WaitTime=500` | confirmed |
| `Skill.csv` 30001 | `DamageCoefficient=161`、`MaxTargets=1` | confirmed |
| `Freeze.csv` 30001 | `Time=1600ms`、`InitAniTime=500ms` | confirmed |
| 闪电丘 FX Bundle | `Emiter_hero_shandianqiu_zidan1` | `SDEmiteBase` 生成 `eff_hero_shandianqiu_zidan1` | confirmed |
| 闪电丘 FX Bundle | `eff_hero_shandianqiu_zidan1` | `SDThunderChainTracker` | confirmed |
| 闪电丘 FX Bundle | 弹体碰撞 | `SDEffectEntityCollision`、`CollisionMaxNum=1` | confirmed |
| 闪电丘 FX Bundle | 命中表现 | `HitEffectPath=...eff_hero_shandianqiu_sj1.prefab` | confirmed |
| 闪电丘 FX Bundle | 命中后销毁 | `destroyDelayTime=0.15000000596046448` | confirmed |
| Lua `SkillStage.lua` | 子弹脱手技能 | 发射后施法者移动，子弹仍继续有效 | confirmed |
| Lua `LiteMonster.lua` | 死亡实体保留 | 最少保留1秒以免影响轨迹表现 | confirmed |

输入哈希：

- `hero_pikaqiu.bytes`：`43bc826f24a295339938a3a3c81fcebab1843a9e4786501dea0bf75da7b17339`
- 闪电丘 FX Bundle `fx_heros_shandianqiu_eba63a02041be39d16eb3c7d86092f3f`：
  `3fa83e1e2f627abdb9615f5bbcb04816db173e2afe87947aaeae9014c3ec07ac`
- `Skill.csv`：`aef551e9e1051a13b3e2606388d18b871023a5fed63cc7e50f8e7cbe89d1f128`
- `Freeze.csv`：`1a782edb82f8d0f40513c3a80761dfac7eaa4d53a392398494fecac0908ff16e`
- `PetSkill.csv`：`3a5058777ebe48ef8f2df8f59124023df06f7a7388afc23efa12261c09f7859a`
- `Effect.csv`：`b0cbdbe7ae126725307a24d853c3f8ca17169bba2c5473b32001613989b55aa0`

### 时间线

| 相对时间 | 事件 | 判定 |
| --- | --- | --- |
| `0s` | 进入 `attack_1` | confirmed |
| `7 / 30 = 0.233333s` | `eventType=27` 创建发射器并生成普通弹体 | confirmed |
| `0.233333s` 之后 | 弹体独立飞行；不能在发射帧直接结算伤害 | confirmed |
| 弹体首次有效碰撞 | 主目标伤害最多结算一次 | confirmed |
| 命中后约 `0.15s` | 弹体表现延迟销毁 | confirmed；不是飞行时间 |
| `0.5s` | `Skill.WaitTime` / `Freeze.InitAniTime` 配置点 | confirmed 配置；具体状态机含义未完全恢复 |
| `0.666667s` | `attack_1` Spine 动画结束 | confirmed |
| `1.6s` | 普攻 Freeze 时间 | confirmed 配置；连续起手仍需独立动态样本验收 |

### 解释边界

- `initSpeed=10` 写入 `SDTracker.InitSpeed`，本关投影为
  `100 logical px / world unit`，但两者不能直接证明
  `10 world units/s = 1000 logical px/s`。`SDTracker.Update` 的推进公式和时间单位仍为
  unknown，因此该换算不得进入生产逻辑。
- `lockTarget=False` 确认本次事件覆盖 Prefab 默认的 `LockTarget=1`。它证明本次不持续锁定目标，
  但目标死亡后是飞向旧落点、销毁还是触发其他分支仍为 unknown，A1 不补默认行为。
- `maxFlyTime=3000` 与 `maxFlyDis=90` 是弹体寿命边界，不是命中耗时。
- `SkillOffset=0.2,0.6` 的字段值已确认；x 偏移是否随朝向翻转仍为 unknown。
- `Effect 30003101` 只确认 `30001|30003` 的效果链与“闪电丘_普攻_连锁”描述；
  连锁搜索中心、顺序、逐跳间隔和目标死亡分支均留给 A2。

### 方法级取证结果

- 原客户端为团结引擎小游戏构建，`global-metadata.dat` 标记版本为 32，并启用了精简元数据结构。
- 主 WASM 的 name section 只保留 `j<number>` 形式的压缩函数名，未保留可直接搜索的
  `SDTracker.Update` / `SDThunderChainTracker.Update` 方法名。
- Rodroid Il2CppDumper 0.5.5 能读入文件但产出空目录；支持 v32 的
  Il2CppDumper `v6.7.46-lxraa.1` 会因精简元数据表宽不兼容，在读取默认值表时失败。
- 用户 GIF 中闪电丘与其他英雄同时攻击，约 12fps，不能把可见弹体或飘字可靠归因到
  闪电丘的一次攻击，因而不能用来确认弹速。
- `global-metadata.dat` 还能确认 `SDEffectBullet2DTracker` 的 `TrackingFly`、
  `UpdateParabolaScale`、`CheckBoundaries`，基类 `SDFly2DTracker` 的 `SpeedValueCurveList`、
  `SpeedChange`、`PositionChange`，以及 `SDThunderChainTracker` 的 `flyDistance`、
  `cacheFlyDistance` 等成员。它证明实际推进还受速度曲线和边界分支控制，不能简化为
  `InitSpeed × pixelsPerWorldUnit`。公开源码检索未找到这些私有类的方法体。
- 三份 Prefab 的速度相关序列化字段已复核：暴走萌弹和小丑皇的 `curve` 都是
  `time=0,value=1` 到 `time=1,value=1` 的恒定曲线，`SpeedValueCurveList` 为空；闪电丘的
  `curve` 为空、`SpeedValueCurveList` 为空，另有 `sampleStep=1`、`Amplitude=1`。因此当前资源
  没有额外序列化变速，但 `Update/TrackingFly` 如何使用这些字段仍须方法体或动态样本确认。

结论：事件覆盖值 `initSpeed=10` 到世界位移的换算仍为 unknown。Prefab 中已进一步确认
`SDThunderChainTracker.InitSpeed=20`，但攻击事件会覆盖为 `10`。当前生产 Core 只记录
发射后在途状态、固定落点意图与寿命边界，`movementScale=null`，不推进、不绘制假弹道、
不在发射帧扣血；等待推进公式确认后再接命中。

## 五单位静态攻击矩阵

以下结果来自固定缓存版本的角色事件、`Skill.csv`、`Freeze.csv`、`Soldier.csv`、
`lord_base_c.csv` 及对应 FX Bundle。所有 Bundle 已校验 SHA-256，结构化结果写入
`manifest.json.attackEvidence`。

| 单位 | 起手事件 | 后续链路 | 射程 / 范围 | 当前判定 |
| --- | --- | --- | --- | --- |
| 闪电丘 | `attack_1` 第7帧 `0.233333s`，事件27 | 发射器1波×1发；`SDThunderChainTracker`；Prefab速度20，被事件覆盖为10；事件不锁定；碰撞最多1次 | 索敌2800；技能效果半径550 | 发射状态已接入；速度到位移换算、命中、死亡目标分支 unknown |
| 暴走萌弹 | `attack_1` 第1帧 `0.033333s`，事件27 | 发射器2波×1发，间隔80ms；`SDEffectBullet2DTracker`；Prefab速度8.5、不锁定；碰撞最多1次 | 索敌3400；技能效果半径550 | 双发状态已接入；飞行与每发62%命中结算 unknown |
| 小丑皇 | `attack_1` 第5帧 `0.166667s`，事件27 | 1波×1发；事件速度10、不锁定；Prefab抛物线速度6，销毁触发子技能30202 | 索敌3200；30201范围800；毒液30202范围550 | 投弹状态已接入且直接伤害保持0；落地与毒区周期、时长、叠加 unknown |
| 精灵大师 | 本体 `attack_1` 第0帧仅事件1音效；技能无需目标 | `SelfChanceBuff` 零延迟触发21001，经21001101召唤52001；上限1 | 本体射程2100仅用于道路生成点搜索；笑笑鬼射程400、索敌1000、技能扇形 `[150,1000]`、最多99目标 | 生成、唯一实例、道路落点与换位归队已接入；小兵自主追敌和扇形命中仍 unknown |
| 沙王 | 实际 variant 104：第2帧 `0.066667s` 受击表现；variant 105 第18帧 `0.6s` 第二次受击表现 | 无弹体；技能110描述两次劈砍，每次80% | 基础索敌400；技能效果半径500、单目标 | Core 已按两帧各结算80%；账号最终攻击力仍需运行验证 |

单位为源码配置的千分之一世界单位；本关投影是每世界单位100逻辑像素。
`Skill.RangeValue` 是效果形状，不能替换索敌距离。

### 弹体 Bundle 哈希

- 暴走萌弹 `fx_heros_jinkesi_1b56cf83ddfd9d492bd726f437c419f9`：
  `5dae9e6f45bb2e3f7c185b3f40e558beceabb835bc7ba36e6b07cdc1078e3ab0`
- 闪电丘 `fx_heros_shandianqiu_eba63a02041be39d16eb3c7d86092f3f`：
  `3fa83e1e2f627abdb9615f5bbcb04816db173e2afe87947aaeae9014c3ec07ac`
- 小丑皇 `fx_heros_timo_dc7189aedbc9e1c88ed4102e55d74c55`：
  `137d535cdcfea86d5926e2f693511fa0d331fd18b0ad324d123b096d5ac3334c`
- 笑笑鬼效果 `fx_heros_xiaozhiguai_4050e8c9f089d54cc640dd4e5e33931c`：
  `22a19218e68dc118f2f1fb2e49e816d58a962f136125db723fb94438568b6a2f`
- 笑笑鬼事件 `char_zhaohuan_xiaozhiguai01_63d009a0028072e0d6caed47c3fcfcb2`：
  `e2ce2a07ebf4b9dd81fe611c3692ca6e1411dfaa5f95dc8ded8220f87b602cf7`
- 沙王 `fx_player_shawang_63649f6f7c2d890d2affcd29ec728b38`：
  `4cf00500764b17c02716f6dd44b3eb440359283d71bd90b0eed3d58f3ca4c9ee`

## 精灵大师召唤链

DBC 解码器现已按字段描述符区分“列表本体索引”和“字典映射后的列表索引”，并把
`value_type=3` 的列表元素从 IEEE-754 位模式还原为浮点值。因此不再依赖手填 ID：

- `Skill 2100`：`NeedSkillTarget=0`、`SelfChanceBuff=[10000,0,21001,10000,0,21002,10000,0,21003]`；
- `Buff 21001`：`nDelayAddTime=0`、`listEffect=[21001101]`；
- `Effect 21001101`：`EffectClass_SummonSoldier`、`listParam=[52001,1,1,1,0]`；
- `hero_c 30004`：`controlSoldier=1`、`nSummonMax=1`；
- `Soldier 52001`：资源120010、模型半径0.4、移动1500、攻击距离400、索敌1000、
  冷却2000ms、基础攻击0、普攻2110、出生 Buff 10362/21080；
- `Skill 2110`：550%伤害、扇形范围 `[150,1000]`、最多99目标；
- `LiteSoldier:PlayBornExhibit/OnBornComplete`：生成后先关闭碰撞并播放 `born`，动画结束才
  开启碰撞、注册 `SoldierIdle/SoldierBattle/SoldierMove` 并启动 AI；小笑笑鬼原 Spine 的
  `born` 时长为 `0.4000000358s`；
- `LiteGeneral:GetCallAddProperties` 把召唤者的 `ENTITY_ATTACK_ATTRIBUTE` 写入召唤物
  `BASE_ATTACK_ATTRIBUTE`；`CalSummonPanelAttack` 计算为总基础攻击加召唤物攻击附加值。

`LiteSoldierGroupClient:GetDestPos` 使用召唤者攻击距离作为半径，
`MapData:ComputeSummonPointInRoads` 将召唤者位置投影到该半径内的原始道路线段，并在多条
候选道路间选择离当前怪物最近的点。首关只有一条道路，所以 Core 使用半径校验后的最近道路点。
英雄空位换位时，现有召唤物同步投影到新位置对应道路点；英雄参与合成被移除时，所属召唤物清理。

Core 已接入小笑笑鬼的原版 `born` 阶段，0.4 秒结束后才进入站立状态。当前仍没有复刻
`AIPartStates.SoldierIdle/SoldierBattle/SoldierMove` 的 C# 决策，因此出生结束后只展示并保留
已确认的战斗参数，不移动、不嘲讽、不攻击、不扣血。这是 confirmed-only 边界。

### 小笑笑鬼三态 AI 方法级取证

进一步解析确认原包使用团结引擎 `global-metadata.dat` v32 slim format：

- `Il2CppTypeDefinition` 记录宽度为 68 字节，共 11390 条；
- `Il2CppMethodDefinition` 记录宽度为 29 字节，共 95133 条；
- Metadata SHA-256：`7a065f51b2a4c2b81d7d5175c7e12adf74e0801776c64ab76b1eef54db43a2da`；
- 含函数跳板的 `wasmcode1` SHA-256：`2672d8fc494f7ece0b78c237619ce89e76aeb566f07d852303746715b1bfad31`。

三个状态类都位于 `rkt.EntityAIComponent.AIState.SoldierAIState`：

| 类 | type index | method range | 关键方法 | token | WASM 跳板 |
| --- | ---: | ---: | --- | --- | --- |
| `SoldierBattleState` | 2341 | 19729–19734 | `OnUpdate` | `0x06004d15` | `j19732` / func 16266 |
| `SoldierIdleState` | 2342 | 19735–19741 | `OnUpdate` | `0x06004d19` | `j19736` / func 16270 |
| `SoldierMoveState` | 2343 | 19742–19749 | `MoveToOriginPoint` | `0x06004d22` | `j19745` / func 16279 |
| `SoldierMoveState` | 2343 | 19742–19749 | `OnUpdate` | `0x06004d24` | `j19747` / func 16281 |

`wasmcode1` 中这些 `j<method index>` 函数不是 C# 方法体，而是函数分包跳板：它们从共享表
取真正方法并 `call_indirect`。真正的 `OnUpdate` / `MoveToOriginPoint` 实现在运行时下载的
`wasmcode2` 归档中；当前原包、微信本地缓存和 `__PATCH_DIR` 都未保存该归档。

因此，新证据已把类、方法、token 和 WASM 入口精确定位，但仍不能确认状态转移顺序、
攻击优先级、移动终止条件或回归原点阈值。正式 Core 仍保持“`born` 后 `stand`、无自主伤害”，
不以方法名或同类游戏经验补全 AI。

可重复定点审计：

```sh
python3 scripts/frontline/audit_slim_metadata.py \
  /private/tmp/frontline-webdata/Il2CppData/Metadata/global-metadata.dat \
  --wasm /private/tmp/frontline-wxapp/_wasmcode1_/wasmcode1/2ef94219ebac60f3.webgl.wasm.code.unityweb.wasm
```

## 沙王最终攻击距离

已确认目标搜索不是单纯比较中心点距离：

- `SkillStage.lua` 把施法者 `ENTITY_RANGE_ATTRIBUTE` 写入技能攻击距离；
- `lord_base_c.nAttackDistance=5;400` 通过 `SwLordClient.lua` 写入领主射程属性；
- `Statement.lua` 将该值除以1000，并按
  `中心距离 <= 攻击距离 + 目标模型半径` 判定；
- 距离排序同样使用 `中心距离 - 目标模型半径`；
- 施法者自身模型半径不参与这条比较。

因此沙王基础攻击边界为 `0.4 world unit + 目标模型半径`，即本关画布上的
`40px + 怪物模型半径投影`。DBC 浮点池解码已补齐，`ConfigResource.fModelRadius` 为：

- `1001` 沙漠蜥蜴、`1002` 野狗、`1003` 沙甲虫：`0.2 world unit` / `20px`；
- `3001` 沙漠蜥蜴精英：`0.35 world unit` / `35px`。

因此沙王中心判定边界分别为普通怪 `60px`、精英怪 `75px`。四英雄也使用同一“基础射程 +
目标模型半径”规则。该规则已写入 Core 与单测。

## 低攻击测试版本

为观察完整攻击过程，战斗载入阶段启用显式测试倍率 `heroAttackScale=0.05`：只缩放四名出战英雄
进入单局 `BattleConfig` 的基础攻击，英雄养成存档和默认面板数值保持不变，沙王不缩放。战斗 HUD
显示“英雄攻击测试 ×5%”，避免把测试结果误认为正式数值。删除传入的测试参数即可完整回滚。

## 当前实现与剩余 A1 边界

已修复偏差：`frontlineCore.ts` 不再把闪电丘 `0.233333s`、暴走萌弹 `0.033333s` 或
小丑皇 `0.166667s` 当成命中。三者只在 Core 创建在途状态；暴走萌弹第二发在第一发后80ms创建。
所有在途状态均有源码寿命边界，但在 `movementScale` 未确认前不推进也不扣血。

A1 剩余项获得缺失证据后才允许修改：

- `BattleState` 中的弹体按原 Tracker 公式由固定步长模拟推进；
- 到达原目标位置时最多结算一次主目标伤害；发射帧不扣血；
- 表现层读取同一弹体状态绘制在途闪电球；
- 保留既有连锁近似，但把触发点从发射帧移到主弹体命中；搜索与逐跳规则仍不在 A1 改写。

本轮还完成：沙王 `0.066667s` 与 `0.6s` 两段各80%结算；精灵大师按零延迟 Buff 链生成唯一
小笑笑鬼并绘制原 Spine；英雄5%攻击测试倍率只进入单局 BattleConfig，不改 roster 或存档。
未修改经济、怪物移动、合成规则和存档。

## A1 阻塞项与所需动态样本

完成 A1 弹体推进仍需要确认 `SDTracker.Update`，或提供一段 x1、只部署闪电丘、目标进入射程后的原版短录像，
最好 60fps 且不打开范围圈。样本需覆盖连续三次起手，并尽量让第一发飞行距离超过一个角色宽度。
该缺口不改变“发射前不得扣血”和“碰撞最多结算一次”的已确认结论。
