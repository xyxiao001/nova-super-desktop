"use client";

import { useState } from "react";
import FrontlineHeroStage from "./FrontlineHeroStage";
import {
  FRONTLINE_HERO_BY_ID,
  FRONTLINE_HEROES,
  type FrontlineHeroDefinition,
  type FrontlineHeroId,
  type FrontlineHeroRoster,
} from "./frontlineRoster";

type FrontlineHeroesProps = {
  roster: FrontlineHeroRoster;
  lineup: FrontlineHeroId[];
  initialFormation?: boolean;
  onUpgrade: (hero: FrontlineHeroDefinition) => void;
  onToggleLineup: (id: FrontlineHeroId) => void;
};

type HeroFilter = "all" | "ranger" | "mage" | "warrior" | "summon" | "poison" | "control" | "support";

const HERO_FILTERS: Array<{ id: HeroFilter; label: string; icon: string }> = [
  { id: "all", label: "全部职业", icon: "hero-role-all.png" },
  { id: "ranger", label: "射手", icon: "hero-role-ranger.png" },
  { id: "mage", label: "法师", icon: "hero-role-mage.png" },
  { id: "warrior", label: "战士", icon: "hero-role-warrior.png" },
  { id: "summon", label: "召唤", icon: "hero-role-summon.png" },
  { id: "poison", label: "毒系", icon: "hero-role-poison.png" },
  { id: "control", label: "控制", icon: "hero-role-control.png" },
  { id: "support", label: "辅助", icon: "hero-role-support.png" },
];

const HERO_UI_ROOT = "/assets/games/frontline/ui/heroes";

type HeroFiltersProps = {
  value: HeroFilter;
  onChange: (filter: HeroFilter) => void;
  className: string;
};

function HeroFilters({ value, onChange, className }: HeroFiltersProps) {
  return (
    <div className={className} aria-label="职业筛选">
      {HERO_FILTERS.map((filter) => (
        <button
          type="button"
          className={filter.id === value ? "active" : ""}
          key={filter.id}
          aria-label={filter.label}
          aria-pressed={filter.id === value}
          onClick={() => onChange(filter.id)}
        >
          <img src={`${HERO_UI_ROOT}/${filter.icon}`} alt="" />
        </button>
      ))}
    </div>
  );
}

export default function FrontlineHeroes({
  roster,
  lineup,
  initialFormation = false,
  onUpgrade,
  onToggleLineup,
}: FrontlineHeroesProps) {
  const [selectedId, setSelectedId] = useState<FrontlineHeroId | null>(null);
  const [heroFilter, setHeroFilter] = useState<HeroFilter>("all");
  const [formationFilter, setFormationFilter] = useState<HeroFilter>("all");
  const [editing, setEditing] = useState(initialFormation);
  const [draftLineup, setDraftLineup] = useState<FrontlineHeroId[]>(lineup);
  const selected = FRONTLINE_HEROES.find((hero) => hero.id === selectedId);
  const filteredHeroes = FRONTLINE_HEROES.filter(
    (hero) => heroFilter === "all" || hero.roleClass === heroFilter,
  );
  const filteredFormationHeroes = FRONTLINE_HEROES.filter(
    (hero) => formationFilter === "all" || hero.roleClass === formationFilter,
  );
  const lineupHeroes = lineup.flatMap((id) => {
    const hero = FRONTLINE_HERO_BY_ID.get(id);
    return hero ? [hero] : [];
  });
  const draftHeroes = draftLineup.flatMap((id) => {
    const hero = FRONTLINE_HERO_BY_ID.get(id);
    return hero ? [hero] : [];
  });

  const openFormation = () => {
    setDraftLineup(lineup);
    setFormationFilter("all");
    setEditing(true);
  };

  const toggleDraftHero = (id: FrontlineHeroId) => {
    setDraftLineup((current) => (
      current.includes(id)
        ? current.filter((heroId) => heroId !== id)
        : current.length < 4 ? [...current, id] : current
    ));
  };

  const saveFormation = () => {
    for (const hero of FRONTLINE_HEROES) {
      if (lineup.includes(hero.id) !== draftLineup.includes(hero.id)) {
        onToggleLineup(hero.id);
      }
    }
    setEditing(false);
  };

  const selectAdjacentHero = (offset: -1 | 1) => {
    if (!selectedId) return;
    const index = FRONTLINE_HEROES.findIndex((hero) => hero.id === selectedId);
    const next = (index + offset + FRONTLINE_HEROES.length) % FRONTLINE_HEROES.length;
    setSelectedId(FRONTLINE_HEROES[next].id);
  };

  return (
    <section className="frontline-heroes" aria-label="英雄">
      <div className="hero-courtyard">
        <div className="frontline-resource-bar hero-resource-bar" aria-label="资源">
          <span aria-label="晶石 115">
            <img className="resource-icon" src={`${HERO_UI_ROOT}/hero-resource-crystal.png`} alt="" />
            <b>115</b>
            <img className="resource-add" src={`${HERO_UI_ROOT}/hero-resource-add.png`} alt="" />
          </span>
          <span aria-label="金币 53.1K">
            <img className="resource-icon" src={`${HERO_UI_ROOT}/hero-resource-coin.png`} alt="" />
            <b>53.1K</b>
            <img className="resource-add" src={`${HERO_UI_ROOT}/hero-resource-add.png`} alt="" />
          </span>
          <span aria-label="体力 421/60">
            <img className="resource-icon" src={`${HERO_UI_ROOT}/hero-resource-stamina.png`} alt="" />
            <b>421/60</b>
            <img className="resource-add" src={`${HERO_UI_ROOT}/hero-resource-add.png`} alt="" />
          </span>
        </div>
        <div className="hero-stage-pedestals" aria-hidden="true">
          {lineupHeroes.map((hero) => <i key={hero.id} />)}
        </div>
        <FrontlineHeroStage
          heroes={lineupHeroes}
          variant="lineup"
          label="当前出战英雄待机动画"
          actorScale={170}
        />
        <div className="hero-stage-roles" aria-hidden="true">
          {lineupHeroes.map((hero) => <img src={hero.roleIcon} alt="" key={hero.id} />)}
        </div>
        <span className="hero-courtyard-menu" aria-hidden="true"><i /><i /><i /><i /></span>
      </div>

      <div className="hero-filter-row">
        <HeroFilters
          value={heroFilter}
          onChange={setHeroFilter}
          className="hero-filters"
        />
        <button type="button" onClick={openFormation}>队伍编辑</button>
      </div>

      <div className="hero-list">
        <p className="hero-roster-bonus">
          <span>暴击伤害增幅: <b>264.80%</b></span>
          <i>!</i>
        </p>

        <div className="hero-card-grid">
          {filteredHeroes.map((hero) => {
            const state = roster[hero.id];
            const active = lineup.includes(hero.id);
            return (
              <button
                type="button"
                className={`hero-card ${active ? "active" : ""}`}
                key={hero.id}
                onClick={() => setSelectedId(hero.id)}
                aria-label={`查看${hero.name}`}
              >
                <span className="hero-card-frame">
                  <img className="hero-card-portrait" src={hero.portrait} alt="" />
                  <img className="hero-card-role" src={hero.roleIcon} alt="" />
                  {active && <em>出战中</em>}
                  <small><b>{state.level}</b><span>{state.pieces}/30</span></small>
                </span>
                <strong>{hero.name}</strong>
              </button>
            );
          })}
        </div>
      </div>

      {editing && (
        <div className="hero-formation-shade">
          <article className="hero-formation" role="dialog" aria-modal="true" aria-label="布阵">
            <header>
              <strong>布阵</strong>
              <button type="button" aria-label="关闭布阵" onClick={() => setEditing(false)}>×</button>
            </header>
            <div className="hero-formation-stage">
              <div className="hero-stage-pedestals" aria-hidden="true">
                {draftHeroes.map((hero) => <i key={hero.id} />)}
              </div>
              <FrontlineHeroStage
                heroes={draftHeroes}
                variant="lineup"
                label="当前布阵英雄待机动画"
                actorScale={210}
              />
              <div className="hero-stage-roles" aria-hidden="true">
                {draftHeroes.map((hero) => <img src={hero.roleIcon} alt="" key={hero.id} />)}
              </div>
              <div className="hero-stage-levels" aria-hidden="true">
                {draftHeroes.map((hero) => (
                  <span key={hero.id}>{roster[hero.id].level}级</span>
                ))}
              </div>
              <strong className="hero-formation-power">⚔ 1182</strong>
            </div>
            <div className="hero-formation-grid">
              {filteredFormationHeroes.map((hero) => {
                const active = draftLineup.includes(hero.id);
                return (
                  <button
                    type="button"
                    className={active ? "active" : ""}
                    key={hero.id}
                    onClick={() => toggleDraftHero(hero.id)}
                    aria-label={`${active ? "下阵" : "上阵"}${hero.name}`}
                  >
                    <img className="portrait" src={hero.head} alt="" />
                    <img className="role" src={hero.roleIcon} alt="" />
                    <span>{roster[hero.id].level}级</span>
                    {active && (
                      <>
                        <img className="selected" src={`${HERO_UI_ROOT}/hero-formation-selected.png`} alt="" />
                        <i aria-hidden="true">✓</i>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <HeroFilters
              value={formationFilter}
              onChange={setFormationFilter}
              className="hero-formation-filters"
            />
            <footer>
              <button type="button" onClick={() => setDraftLineup([])}>一键下阵</button>
              <button type="button" onClick={saveFormation}>保存阵容</button>
            </footer>
            <nav aria-label="编队方案">
              <button type="button" className="active">第一编队</button>
              <button type="button" disabled>第二编队</button>
              <button type="button" disabled>第三编队</button>
              <button type="button" disabled>第四编队</button>
            </nav>
          </article>
        </div>
      )}

      {selected && (
        <div className="hero-detail-shade">
          <article className="hero-detail" role="dialog" aria-modal="true" aria-label={`${selected.name}详情`}>
            <header>
              <strong>英雄</strong>
              <button type="button" aria-label="关闭英雄详情" onClick={() => setSelectedId(null)}>×</button>
            </header>
            <div className="hero-showcase">
              <div className="hero-showcase-name">
                <b>{selected.name}</b>
                <span
                  className={selected.roleClass}
                  style={{ backgroundImage: `url("${selected.roleLabel}")` }}
                >
                  <img src={selected.roleIcon} alt="" />{selected.role}
                </span>
              </div>
              <button
                type="button"
                className="previous"
                aria-label="上一个英雄"
                onClick={() => selectAdjacentHero(-1)}
              >‹</button>
              <FrontlineHeroStage
                heroes={[selected]}
                variant="detail"
                label={`${selected.name}待机动画`}
              />
              <button
                type="button"
                className="next"
                aria-label="下一个英雄"
                onClick={() => selectAdjacentHero(1)}
              >›</button>
            </div>
            <div className="hero-skills" aria-label="英雄技能">
              <span><img src={selected.skillIcons[0]} alt="" /></span>
              <span className="ultimate"><img src={selected.skillIcons[1]} alt="" /><b>大招</b></span>
              <span className="talent"><img src={selected.skillIcons[2]} alt="" /><img className="lock" src={`${HERO_UI_ROOT}/hero-lock.png`} alt="" /><b>天赋</b></span>
              <i aria-hidden="true" />
              <strong>符文</strong>
            </div>
            <div className="hero-stats">
              <span><img src={`${HERO_UI_ROOT}/hero-stat-level.png`} alt="" />等级:{roster[selected.id].level}/60</span>
              <span><img src={`${HERO_UI_ROOT}/hero-stat-attack.png`} alt="" />攻击:{roster[selected.id].attack}</span>
              <span><img src={`${HERO_UI_ROOT}/hero-stat-interval.png`} alt="" />攻击间隔:{selected.intervalSeconds.toFixed(1)}</span>
            </div>
            <div className="hero-milestones">
              {selected.milestones.map((item) => {
                const unlocked = roster[selected.id].level >= item.level;
                return (
                  <div className={unlocked ? "unlocked" : ""} key={item.level}>
                    <b>Lv.{item.level}</b>
                    <span>{item.text}</span>
                    {!unlocked && <img src={`${HERO_UI_ROOT}/hero-lock.png`} alt="" />}
                  </div>
                );
              })}
            </div>
            <p className="hero-upgrade-reward">升级奖励：暴击伤害增幅: <b>+1.40%</b></p>
            <footer>
              <span><img src={`${HERO_UI_ROOT}/hero-role-all.png`} alt="" /></span>
              <label>
                <img src={selected.head} alt="" />
                <small>{roster[selected.id].pieces}/30</small>
              </label>
              <label>
                <img src={selected.roleIcon} alt="" />
                <small className={roster[selected.id].material < selected.materialCost ? "short" : ""}>
                  {roster[selected.id].material}/{selected.materialCost}
                </small>
              </label>
              <button
                type="button"
                onClick={() => onUpgrade(selected)}
                disabled={roster[selected.id].material < selected.materialCost}
              >升级</button>
            </footer>
          </article>
        </div>
      )}
    </section>
  );
}
