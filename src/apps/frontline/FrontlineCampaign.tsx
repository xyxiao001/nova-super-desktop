"use client";

import { useMemo, useState } from "react";
import FrontlineHeroStage from "./FrontlineHeroStage";
import {
  FRONTLINE_HERO_BY_ID,
  type FrontlineHeroId,
  type FrontlineHeroRoster,
} from "./frontlineRoster";

const CAMPAIGN_ASSET_ROOT = "/assets/games/frontline/ui/campaign";

type FrontlineCampaignProps = {
  stars: 0 | 1 | 2 | 3;
  power: number;
  roster: FrontlineHeroRoster;
  lineup: FrontlineHeroId[];
  onEditLineup: () => void;
  onOpenRecruit: () => void;
  onStartLevel: () => void;
};

const CONDITIONS = [
  "成功通关",
  "220 秒内通关",
  "水晶保持满血",
] as const;

const MONSTERS = [
  { name: "沙甲虫", image: "monster-scarab.png" },
  { name: "沙漠蜥蜴", image: "monster-lizard.png" },
  { name: "野狗", image: "monster-hound.png" },
] as const;

const REWARDS = [
  { name: "金币", image: "reward-coin.png" },
  { name: "经验", image: "reward-experience.png" },
  { name: "招募券", image: "reward-ticket.png" },
  { name: "粮草", image: "reward-ration.png" },
] as const;

export default function FrontlineCampaign({
  stars,
  power,
  roster,
  lineup,
  onEditLineup,
  onOpenRecruit,
  onStartLevel,
}: FrontlineCampaignProps) {
  const [showChallenge, setShowChallenge] = useState(false);
  const lineupHeroes = useMemo(
    () => lineup
      .map((id) => FRONTLINE_HERO_BY_ID.get(id))
      .filter((hero) => hero !== undefined),
    [lineup],
  );

  return (
    <section className="frontline-campaign" aria-label="第一章战役地图">
      <header className="campaign-account-bar">
        <div className="campaign-player">
          <img
            src={FRONTLINE_HERO_BY_ID.get("lightning")?.head}
            alt=""
          />
          <span>
            <strong>新手呢</strong>
            <small>Lv.17</small>
          </span>
          <b aria-label={`战力 ${power}`}>⚔ {power}</b>
        </div>
        <div className="campaign-resources" aria-label="资源">
          <span className="crystal"><i />115</span>
          <span className="coin"><i />53.1K</span>
          <span className="stamina"><i />271/60</span>
        </div>
      </header>

      <div className="campaign-map-nodes" aria-label="第一章关卡">
        <div className="campaign-node locked node-one" aria-hidden="true">
          <span>☆☆☆</span>
          <i />
        </div>
        <div className="campaign-node locked node-two" aria-hidden="true">
          <span>☆☆☆</span>
          <i />
        </div>
        <div className="campaign-node locked node-three" aria-hidden="true">
          <span>☆☆☆</span>
          <i />
        </div>
        <button
          type="button"
          className="campaign-node current node-current"
          onClick={() => setShowChallenge(true)}
          aria-label="查看第一关 烈日沙漠1"
        >
          <span>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</span>
          <i />
        </button>
      </div>

      <button
        type="button"
        className="campaign-chapter-button"
        onClick={() => setShowChallenge(true)}
      >
        <small>1. 烈日沙漠</small>
        <strong>最新章节</strong>
      </button>
      <button
        type="button"
        className="campaign-recruit-shortcut"
        onClick={onOpenRecruit}
        aria-label="打开招募"
      >
        <img
          src={`${CAMPAIGN_ASSET_ROOT}/reward-ticket.png`}
          alt=""
        />
        <span>招募</span>
      </button>

      {showChallenge && (
        <div className="campaign-challenge-backdrop">
          <article
            className="campaign-challenge"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-challenge-title"
          >
            <header>
              <h2 id="campaign-challenge-title">挑战</h2>
              <button
                type="button"
                onClick={() => setShowChallenge(false)}
                aria-label="关闭挑战面板"
              >
                ×
              </button>
            </header>

            <div className="campaign-challenge-lineup">
              <FrontlineHeroStage
                heroes={lineupHeroes}
                variant="lineup"
                label="第一关出战英雄待机动画"
              />
              <strong>⚔ {power}</strong>
              <div className="campaign-lineup-levels" aria-hidden="true">
                {lineupHeroes.map((hero) => (
                  <span key={hero.id}>
                    {roster[hero.id].level}级
                    <i className={hero.roleClass} />
                  </span>
                ))}
              </div>
            </div>

            <section className="campaign-level-goals">
              <h3>1-1. 烈日沙漠1</h3>
              <div>
                {CONDITIONS.map((condition, index) => (
                  <span
                    key={condition}
                    className={stars > index ? "complete" : ""}
                  >
                    <i>{stars > index ? "✓" : "★"}</i>
                    <small>{condition}</small>
                  </span>
                ))}
              </div>
            </section>

            <section className="campaign-monsters">
              <h3>本关怪物</h3>
              <div>
                {MONSTERS.map((monster) => (
                  <figure key={monster.name}>
                    <img
                      src={`${CAMPAIGN_ASSET_ROOT}/${monster.image}`}
                      alt=""
                    />
                    <figcaption>{monster.name}</figcaption>
                  </figure>
                ))}
              </div>
            </section>

            <section className="campaign-rewards">
              <h3>奖励预览</h3>
              <div>
                {REWARDS.map((reward) => (
                  <img
                    key={reward.name}
                    src={`${CAMPAIGN_ASSET_ROOT}/${reward.image}`}
                    alt={reward.name}
                  />
                ))}
              </div>
            </section>

            <footer>
              <button
                type="button"
                className="formation"
                onClick={onEditLineup}
              >
                布阵
              </button>
              <button
                type="button"
                className="battle"
                onClick={onStartLevel}
              >
                出战
              </button>
            </footer>
          </article>
        </div>
      )}
    </section>
  );
}
