"use client";

export type FrontlineHeroId = "lightning" | "jinx" | "summoner" | "clown";

export type FrontlineHeroState = {
  level: number;
  attack: number;
  pieces: number;
  material: number;
};

export type FrontlineHeroRoster = Record<FrontlineHeroId, FrontlineHeroState>;

export type FrontlineHeroDefinition = {
  id: FrontlineHeroId;
  actorId: string;
  sourceId: number;
  name: string;
  role: string;
  roleClass: string;
  roleIcon: string;
  roleLabel: string;
  intervalSeconds: number;
  portrait: string;
  head: string;
  skillIcons: [string, string, string];
  materialIcon: string;
  materialCost: number;
  ultimate: string;
  milestones: Array<{ level: number; text: string }>;
};

export const FRONTLINE_HEROES: FrontlineHeroDefinition[] = [
  {
    id: "summoner",
    actorId: "hero-summoner",
    sourceId: 30004,
    name: "精灵大师",
    role: "召唤",
    roleClass: "summon",
    roleIcon: "/assets/games/frontline/ui/heroes/hero-role-summon.png",
    roleLabel: "/assets/games/frontline/ui/heroes/hero-role-label-summon.png",
    intervalSeconds: 20,
    portrait: "/assets/games/frontline/ui/heroes/lihui_hero_25_xiaozi.png",
    head: "/assets/games/frontline/ui/heroes/icon_hero_25_xiaozhi.png",
    skillIcons: [
      "/assets/games/frontline/ui/heroes/skill-summoner-1.png",
      "/assets/games/frontline/ui/heroes/skill-summoner-3.png",
      "/assets/games/frontline/ui/heroes/skill-summoner-2.png",
    ],
    materialIcon: "●",
    materialCost: 192,
    ultimate: "暗夜魔影",
    milestones: [
      { level: 5, text: "解锁大招 [暗夜魔影] 选项" },
      { level: 10, text: "初始获得 [怨恨]，造成伤害降低15%" },
      { level: 15, text: "生命值到0时获得3秒无敌，解锁1星天赋" },
      { level: 20, text: "以5行5列对附近敌人眩晕2秒" },
    ],
  },
  {
    id: "clown",
    actorId: "hero-clown",
    sourceId: 30005,
    name: "小丑皇",
    role: "毒系",
    roleClass: "poison",
    roleIcon: "/assets/games/frontline/ui/heroes/hero-role-poison.png",
    roleLabel: "/assets/games/frontline/ui/heroes/hero-role-label-poison.png",
    intervalSeconds: 3,
    portrait: "/assets/games/frontline/ui/heroes/lihui_hero_23_timo.png",
    head: "/assets/games/frontline/ui/heroes/icon_hero_23_timo.png",
    skillIcons: [
      "/assets/games/frontline/ui/heroes/skill-clown-1.png",
      "/assets/games/frontline/ui/heroes/skill-clown-2.png",
      "/assets/games/frontline/ui/heroes/skill-clown-3.png",
    ],
    materialIcon: "☠",
    materialCost: 240,
    ultimate: "双爪旋风",
    milestones: [
      { level: 5, text: "解锁大招 [双爪旋风] 选项" },
      { level: 10, text: "解锁 [电虫毒刺] 选项" },
      { level: 15, text: "中毒使目标治疗效果减少60%，解锁1星天赋" },
      { level: 20, text: "中毒效果持续时间增加2秒" },
    ],
  },
  {
    id: "jinx",
    actorId: "hero-jinx",
    sourceId: 30002,
    name: "暴走萌弹",
    role: "射手",
    roleClass: "ranger",
    roleIcon: "/assets/games/frontline/ui/heroes/hero-role-ranger.png",
    roleLabel: "/assets/games/frontline/ui/heroes/hero-role-label-ranger.png",
    intervalSeconds: 0.8,
    portrait: "/assets/games/frontline/ui/heroes/lihui_hero_20_jinkesi.png",
    head: "/assets/games/frontline/ui/heroes/icon_hero_20_jinkesi.png",
    skillIcons: [
      "/assets/games/frontline/ui/heroes/skill-jinx-1.png",
      "/assets/games/frontline/ui/heroes/skill-jinx-2.png",
      "/assets/games/frontline/ui/heroes/skill-jinx-3.png",
    ],
    materialIcon: "➶",
    materialCost: 240,
    ultimate: "枪炮交响曲",
    milestones: [
      { level: 5, text: "解锁大招 [枪炮交响曲] 选项" },
      { level: 10, text: "初始获得 [罪恶快感]" },
      { level: 15, text: "最高星暴走萌弹每隔20秒，攻击力大幅提升10秒" },
      { level: 20, text: "惊吓盒引爆范围增加40%，伤害增加60%" },
    ],
  },
  {
    id: "lightning",
    actorId: "hero-lightning",
    sourceId: 30001,
    name: "闪电丘",
    role: "法师",
    roleClass: "mage",
    roleIcon: "/assets/games/frontline/ui/heroes/hero-role-mage.png",
    roleLabel: "/assets/games/frontline/ui/heroes/hero-role-label-mage.png",
    intervalSeconds: 1.6,
    portrait: "/assets/games/frontline/ui/heroes/lihui_hero_21_pikaqiu.png",
    head: "/assets/games/frontline/ui/heroes/icon_hero_21_pikaqiu.png",
    skillIcons: [
      "/assets/games/frontline/ui/heroes/skill-lightning-1.png",
      "/assets/games/frontline/ui/heroes/skill-lightning-2.png",
      "/assets/games/frontline/ui/heroes/skill-lightning-3.png",
    ],
    materialIcon: "ϟ",
    materialCost: 384,
    ultimate: "百万伏特",
    milestones: [
      { level: 5, text: "解锁大招 [百万伏特] 选项" },
      { level: 10, text: "[电磁爆炸] 暴击率 +20%" },
      { level: 15, text: "百万伏特伤害 +30%，命中时有50%概率麻痹敌人" },
      { level: 20, text: "连锁伤害提高至100%" },
    ],
  },
];

export const FRONTLINE_HERO_BY_ID = new Map(
  FRONTLINE_HEROES.map((hero) => [hero.id, hero]),
);
