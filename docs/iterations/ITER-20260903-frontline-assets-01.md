# ITER-20260903：前线资源管线与动画可行性

- 状态：已完成
- 所属 Spec：`docs/specs/SPEC-20260903-frontline-faithful-battle.md`
- 对应验收项：AC-4、AC-5、AC-7
- 开始日期：2026-09-03
- 完成日期：2026-09-03

## 本轮目标

建立固定资源版本的确定性提取管线，确认 Spine Web 运行时兼容性，并用一个第一章敌人与一个 Unity 粒子完成独立 WebGL 预览。

## 本轮不做

- 不实现关卡、波次、索敌、伤害、召唤、强化或结算；
- 不扩展现有 DOM 战斗原型；
- 不导出 v1 全量资源；
- 不启动开发服务器，不运行 lint 或完整构建。

## 计划修改

- `scripts/frontline/`：固定哈希提取和 Spine 元数据检查；
- `public/assets/games/frontline/manifest.json`：资源版本、哈希、动画和粒子契约；
- `public/assets/games/frontline/spine/`：首个敌人的原始骨骼资源；
- `public/assets/games/frontline/effects/`：首个 Unity 粒子纹理与参数；
- `src/apps/frontline/preview/`：900×1600 WebGL 动画预览；
- `tests/unit/frontlineAssets.test.ts`：资源契约测试。

## 实现假设

Spine 二进制头标为 `4.2.33`，使用同一 4.2 系列的最新补丁运行时 `4.2.120` 直读；不启用离线逐帧烘焙，也不保留第二套角色动画管线。

## 实现—验证记录

### 第 1 轮

- 实现：锁定两个 AssetBundle 的 SHA-256，导出 `monster_01_xiyi` 的 `.skel + .atlas + texture`，并导出 `huoqiu_start` 粒子翻页纹理和 Unity 参数。
- 验证：官方 Spine `4.2.120` 成功解析二进制；`4.2.33` 运行时补丁无法解析该同版本编辑器导出，故按 Spine 的 major/minor 兼容规则使用 4.2 最新补丁。
- 结果：资源和粒子链路成立；原骨骼只含 `stand`、`run`、`attack_1`、`dead`，不存在 `hurt` 动画或动画事件轨。

### 第 2 轮

- 实现：新增独立 `/frontline-preview` 路由，以官方 Spine WebGL 运行时播放四个源骨骼动画，并按 Unity 参数播放 `huoqiu_start` additive 翻页粒子。
- 验证：修正 Unity 世界单位到 900×1600 逻辑画布的缩放后，通过 Canvas 帧缓冲采样验证五个预览入口；所有资源请求成功，无资源或 WebGL 运行时错误。
- 结果：待机、移动、攻击、死亡与粒子均可独立触发；没有把火球粒子或自造动作伪装为 `hurt`。

## 资源事实

- 源 Unity 版本：`2022.3.48t7`；
- Spine 二进制版本：`4.2.33`；
- 第一章蜥蜴敌人动画：`stand`、`run`、`attack_1`、`dead`；
- 第一章蜥蜴敌人的 Spine 动画事件：无；
- 第一章其余四个怪物的 GPU 动画组同样只有 `stand`、`run`、`attack_1`、`dead`；
- `hurt` 在源骨骼中缺失，不能伪造为 Spine 动画；
- `huoqiu_start` 使用 5×4、30fps、1 秒的原粒子翻页纹理。
- Lua 包使用 `rkt` 容器而非标准 ZIP，迭代 1 未从其中取得可验证的攻击事件时点。

## 验证结果

- [x] `npx tsc --noEmit`
- [x] 相关单测：`tests/unit/frontlineAssets.test.ts`、`tests/unit/frontlineCore.test.ts`，共 9 项
- [x] 关键交互：四种源动画与一个原 Unity 粒子均可切换
- [x] Canvas 像素检查：900×1600；待机 1843、移动 1796、攻击 1854、死亡 1815、粒子 2067 个非背景采样点
- [x] 未运行 lint
- [x] 未运行完整构建

## Diff 审计

- [x] 所有修改都对应本轮目标
- [x] 没有未授权的兜底、校验、兼容或重构
- [x] Spec 的不修改边界保持不变
- [x] 没有覆盖用户原有修改
- [x] `git diff --check` 通过

## 交付记录

- 完成结果：固定版本资源提取、Manifest、Spine 直读和粒子等价预览已完成；
- 用户可感知变化：通过 `/frontline-preview` 可进入原资源 WebGL 预览；
- 未实现能力：战斗、完整生命周期、全量粒子与音频；
- 新增或更新 ADR：无；
- 回写 Spec 的后续事项：已明确 `hurt` 可由源客户端实际材质/特效承担；迭代 2 改为先完成第一关全量资源与行为审计，再进入整关复刻和逐关扩展。
