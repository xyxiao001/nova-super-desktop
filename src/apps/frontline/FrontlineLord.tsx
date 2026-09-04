"use client";

import { useState } from "react";

type FrontlineLordProps = {
  power: number;
  gearLevel: number;
  onUpgrade: () => void;
};

const EQUIPMENT = ["刃", "冠", "甲", "戒", "靴", "印"];

export default function FrontlineLord({ power, gearLevel, onUpgrade }: FrontlineLordProps) {
  const [tab, setTab] = useState<"装备" | "符文" | "材料">("装备");

  return (
    <section className="frontline-lord" aria-label="领主">
      <header className="frontline-resource-bar">
        <span>晶石 <b>115</b></span>
        <span>金币 <b>55.7K</b></span>
        <span>体力 <b>290/60</b></span>
      </header>
      <div className="lord-scene">
        <div className="lord-loadout">
          {EQUIPMENT.slice(0, 3).map((icon, index) => (
            <button type="button" aria-label={`装备${index + 1}`} key={icon}>
              <b>1阶</b><span>{icon}</span><small>{gearLevel}级</small>
            </button>
          ))}
        </div>
        <div className="lord-center">
          <div className="lord-plan">方案1 <span>⌄</span></div>
          <img src="/assets/games/frontline/ui/lord/lihui_lingzhu_01_shawang.png" alt="沙王" />
          <h2>沙王</h2>
          <strong>战力 {power}</strong>
        </div>
        <div className="lord-loadout">
          {EQUIPMENT.slice(3).map((icon, index) => (
            <button type="button" aria-label={`装备${index + 4}`} key={icon}>
              <b>1阶</b><span>{icon}</span><small>{gearLevel}级</small>
            </button>
          ))}
        </div>
      </div>
      <nav className="lord-feature-nav" aria-label="领主功能">
        <button type="button" className="active">领主</button><button type="button">宠物</button><button type="button">天赋</button><button type="button">圣剑</button>
      </nav>
      <div className="lord-bag-title">
        <strong>我的背包</strong>
        <span>{tab}</span>
      </div>
      <div className="lord-bag">
        {EQUIPMENT.slice(1, 6).map((icon) => (
          <button type="button" aria-label={`背包装备 ${icon}`} key={icon}>
            <b>1阶</b><span>{icon}</span><small>{gearLevel}级</small>
          </button>
        ))}
      </div>
      <div className="lord-tabs">
        {(["符文", "装备", "材料"] as const).map((item) => <button type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}
      </div>
      <div className="lord-actions">
        <button type="button">一键穿戴</button>
        <button type="button">分解</button>
        <button type="button" onClick={onUpgrade}>升级</button>
      </div>
    </section>
  );
}
