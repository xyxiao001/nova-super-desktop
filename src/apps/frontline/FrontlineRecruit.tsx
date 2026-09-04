"use client";

import { useMemo, useState } from "react";
import {
  FRONTLINE_HEROES,
  FRONTLINE_HERO_BY_ID,
  type FrontlineHeroId,
} from "./frontlineRoster";

export type FrontlineRecruitState = {
  tickets: number;
  experience: number;
  exchangeProgress: number;
};

type FrontlineRecruitProps = FrontlineRecruitState & {
  onRecruit: (heroIds: FrontlineHeroId[]) => void;
};

export const drawRecruitHeroes = (
  count: number,
  random: () => number = Math.random,
): FrontlineHeroId[] => Array.from({ length: count }, () => {
  const index = Math.min(
    FRONTLINE_HEROES.length - 1,
    Math.floor(random() * FRONTLINE_HEROES.length),
  );
  return FRONTLINE_HEROES[index].id;
});

export default function FrontlineRecruit({
  tickets,
  experience,
  exchangeProgress,
  onRecruit,
}: FrontlineRecruitProps) {
  const [tab, setTab] = useState<"heroes" | "stars">("heroes");
  const [results, setResults] = useState<FrontlineHeroId[]>([]);
  const groupedResults = useMemo(() => results.reduce<
    Array<{ id: FrontlineHeroId; count: number }>
  >((groups, id) => {
    const current = groups.find((group) => group.id === id);
    if (current) current.count += 1;
    else groups.push({ id, count: 1 });
    return groups;
  }, []), [results]);

  const recruit = (count: 1 | 10) => {
    if (tickets < count) return;
    const heroIds = drawRecruitHeroes(count);
    onRecruit(heroIds);
    setResults(heroIds);
  };

  return (
    <section className="frontline-recruit" aria-label="英雄招募">
      <header className="frontline-resource-bar">
        <span>招募券 <b>{tickets}</b></span>
        <span>英雄兑换 <b>{exchangeProgress}/100</b></span>
      </header>

      <nav className="recruit-tabs" aria-label="招募类型">
        <button
          type="button"
          className={tab === "heroes" ? "active" : ""}
          onClick={() => setTab("heroes")}
        >
          英雄招募
        </button>
        <button
          type="button"
          className={tab === "stars" ? "active" : ""}
          onClick={() => setTab("stars")}
        >
          星辰招募
        </button>
      </nav>

      <div className={`recruit-stage ${tab}`}>
        <div className="recruit-title">
          <span>召集令</span>
          <strong>{tab === "heroes" ? "英雄招募" : "星辰招募"}</strong>
          <small>四位英雄均可获得</small>
        </div>
        <div className="recruit-lineup" aria-label="本期英雄">
          {FRONTLINE_HEROES.map((hero) => (
            <img src={hero.portrait} alt={hero.name} key={hero.id} />
          ))}
        </div>
      </div>

      <section className="recruit-progress" aria-label="招募进度">
        <header><strong>Lv2</strong><span>Lv3 传说英雄概率提升100%</span></header>
        <div><i style={{ width: `${Math.min(100, experience / 12)}%` }} /></div>
        <small>{experience}/1200</small>
      </section>

      <footer className="recruit-actions">
        <button type="button" onClick={() => recruit(1)} disabled={tickets < 1}>
          <strong>招募 1 次</strong>
          <span>券 {tickets}/1</span>
        </button>
        <button type="button" onClick={() => recruit(10)} disabled={tickets < 10}>
          <strong>招募 10 次</strong>
          <span>券 {tickets}/10</span>
        </button>
      </footer>

      {results.length > 0 && (
        <div className="recruit-result-shade">
          <article className="recruit-result" role="dialog" aria-modal="true" aria-label="招募结果">
            <header>
              <strong>招募成功</strong>
              <button type="button" aria-label="关闭招募结果" onClick={() => setResults([])}>×</button>
            </header>
            <div>
              {groupedResults.map(({ id, count }) => {
                const hero = FRONTLINE_HERO_BY_ID.get(id);
                if (!hero) return null;
                return (
                  <figure key={id}>
                    <img src={hero.head} alt="" />
                    <figcaption>{hero.name}<b>碎片 ×{count}</b></figcaption>
                  </figure>
                );
              })}
            </div>
            <button type="button" onClick={() => setResults([])}>确定</button>
          </article>
        </div>
      )}
    </section>
  );
}
