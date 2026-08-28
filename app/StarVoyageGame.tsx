"use client";

import "./games-tools.css";

import { useEffect, useMemo, useRef, useState } from "react";

import GameResultDialog from "./GameResultDialog";
import {
  clearGameProgress,
  finishGame,
  loadGameProgress,
  saveGameProgress,
  subscribeGameReset,
  touchGame,
} from "./gameStorage";
import { playNovaSound } from "./novaSettings";
import {
  EnemyShipArt,
  PlayerShipArt,
  VoyageCardArt,
  VoyageNodeArt,
} from "./StarVoyageArt";
import {
  VOYAGE_CARDS,
  VOYAGE_ENEMIES,
  VOYAGE_RELICS,
  buyVoyageShopItem,
  chooseVoyageReward,
  createVoyageRun,
  currentEnemyIntent,
  endVoyageTurn,
  enterVoyageNode,
  leaveVoyageShop,
  playVoyageCard,
  reachableVoyageNodeIds,
  resolveVoyageEvent,
  resolveVoyageRepair,
  type VoyageCardId,
  type VoyageNode,
  type VoyageState,
} from "./starVoyageCore";

const NODE_LABELS = {
  combat: "异常信号",
  elite: "精英封锁",
  event: "未知事件",
  shop: "边境星港",
  repair: "维修平台",
  boss: "星门核心",
} as const;

const nodePosition = (node: VoyageNode, nodes: VoyageNode[]) => {
  const count = nodes.filter((item) => item.column === node.column).length;
  const y = count === 1 ? 50 : count === 2 ? 34 + node.row * 32 : 22 + node.row * 28;
  return { x: 8 + node.column * 14, y };
};

function HullMeter({ value, max, enemy = false }: { value: number; max: number; enemy?: boolean }) {
  return <div className={`voyage-hull-meter ${enemy ? "enemy" : ""}`}><span><i style={{ width: `${Math.max(0, value / max * 100)}%` }}/></span><b>{value}</b><small>/ {max}</small></div>;
}

function CardButton({ cardId, index, disabled, onPlay }: { cardId: VoyageCardId; index: number; disabled: boolean; onPlay: () => void }) {
  const card = VOYAGE_CARDS[cardId];
  return <button className={`voyage-card ${card.type}`} disabled={disabled} onClick={onPlay} style={{ "--card-index": index } as React.CSSProperties}>
    <header><b>{card.cost}</b><strong>{card.name}</strong></header>
    <VoyageCardArt cardId={card.id}/>
    <p>{card.detail}</p>
    <small>{card.type === "attack" ? "武器" : card.type === "system" ? "系统" : "战术"}{card.exhaust ? " · 单次" : ""}</small>
  </button>;
}

function VoyageMap({ state, onEnter }: { state: VoyageState; onEnter: (nodeId: string) => void }) {
  const reachable = new Set(reachableVoyageNodeIds(state));
  const visited = new Set(state.visitedNodeIds);
  return <section className="voyage-map-screen">
    <div className="voyage-map-heading"><span>SECTOR 07 / 边境星门</span><strong>选择下一次跃迁</strong><p>航线一旦确认便无法返回。</p></div>
    <div className="voyage-map-chart">
      <svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
        {state.nodes.flatMap((node) => node.nextIds.map((nextId) => {
          const next = state.nodes.find((item) => item.id === nextId)!;
          const start = nodePosition(node, state.nodes);
          const end = nodePosition(next, state.nodes);
          return <path key={`${node.id}-${next.id}`} d={`M${start.x * 10} ${start.y * 5} C${(start.x + 6) * 10} ${start.y * 5},${(end.x - 6) * 10} ${end.y * 5},${end.x * 10} ${end.y * 5}`} className={visited.has(node.id) && (visited.has(next.id) || reachable.has(next.id)) ? "active" : ""}/>;
        }))}
      </svg>
      {state.nodes.map((node) => {
        const position = nodePosition(node, state.nodes);
        const enabled = reachable.has(node.id);
        return <button key={node.id} className={`voyage-map-node ${node.type} ${enabled ? "reachable" : ""} ${visited.has(node.id) ? "visited" : ""} ${state.currentNodeId === node.id ? "current" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} disabled={!enabled} aria-label={`${NODE_LABELS[node.type]}${enabled ? "，可进入" : ""}`} onClick={() => onEnter(node.id)}>
          <VoyageNodeArt type={node.type}/><span>{NODE_LABELS[node.type]}</span>
        </button>;
      })}
      <div className="voyage-map-planet" aria-hidden="true"><i/><b/></div>
    </div>
    <aside className="voyage-manifest">
      <header><span>晨星号 · SEED {state.seed.toString(36).toUpperCase()}</span><strong>远征清单</strong></header>
      <div><small>舰体</small><HullMeter value={state.hull} max={state.maxHull}/></div>
      <dl><div><dt>战术模块</dt><dd>{state.deck.length}</dd></div><div><dt>信用点</dt><dd>{state.credits}</dd></div><div><dt>已清除威胁</dt><dd>{state.battlesWon}</dd></div></dl>
      <section><strong>舰载遗物</strong>{state.relics.length ? state.relics.map((id) => <p key={id}><b>{VOYAGE_RELICS[id].name}</b><span>{VOYAGE_RELICS[id].detail}</span></p>) : <p className="empty">尚未安装遗物</p>}</section>
    </aside>
  </section>;
}

function VoyageCombat({ state, onPlay, onEndTurn }: { state: VoyageState; onPlay: (index: number) => void; onEndTurn: () => void }) {
  const battle = state.battle!;
  const enemy = VOYAGE_ENEMIES[battle.enemyId];
  const intent = currentEnemyIntent(state)!;
  return <section className="voyage-combat">
    <div className="voyage-space-grid" aria-hidden="true"/>
    <section className="voyage-enemy">
      <header><div><small>{enemy.title}</small><strong>{enemy.name}</strong></div><HullMeter value={battle.enemyHull} max={enemy.maxHull} enemy/></header>
      <EnemyShipArt art={enemy.art}/>
      <aside className={`voyage-intent ${intent.kind}`}><span>{intent.kind === "attack" ? "目标锁定" : intent.kind === "guard" ? "防御协议" : "正在充能"}</span><strong>{intent.label}</strong><b>{intent.kind === "attack" ? `${intent.value}${intent.hits ? ` × ${intent.hits}` : ""}` : intent.kind === "guard" ? `+${intent.value} 护盾` : "下一击增强"}</b></aside>
      {!!battle.enemyShield && <div className="voyage-floating-stat enemy-shield">◇ {battle.enemyShield}</div>}
    </section>
    <section className="voyage-player">
      <PlayerShipArt/>
      <div className="voyage-floating-stat player-shield">◇ {battle.shield}</div>
      <div className="voyage-player-status"><strong>晨星号</strong><HullMeter value={state.hull} max={state.maxHull}/></div>
    </section>
    <footer className="voyage-combat-console">
      <div className="voyage-energy"><span>{battle.energy}</span><small>能量</small></div>
      <div className="voyage-hand">{battle.hand.map((cardId, index) => <CardButton key={`${cardId}-${index}`} cardId={cardId} index={index} disabled={VOYAGE_CARDS[cardId].cost > battle.energy} onPlay={() => onPlay(index)}/>)}</div>
      <button className="voyage-end-turn" onClick={onEndTurn}><span>结束回合</span><small>TURN {battle.turn}</small></button>
    </footer>
  </section>;
}

function VoyageReward({ state, onChoose }: { state: VoyageState; onChoose: (card?: VoyageCardId) => void }) {
  return <section className="voyage-choice-screen reward">
    <header><span>战术打捞</span><strong>选择一项模块</strong><p>新模块会永久加入本次远征的抽牌堆。</p></header>
    <div className="voyage-reward-cards">{state.rewards.map((cardId, index) => <CardButton key={cardId} cardId={cardId} index={index} disabled={false} onPlay={() => onChoose(cardId)}/>)}</div>
    <button className="voyage-skip" onClick={() => onChoose()}>放弃打捞</button>
  </section>;
}

function VoyageEventScreen({ state, onChoose }: { state: VoyageState; onChoose: (choice: 0 | 1) => void }) {
  const event = state.event!;
  const choices = event.id === "derelict"
    ? [["进入货舱", "获得 32 信用点，损失 8 舰体"], ["保持距离", "恢复 8 舰体"]]
    : event.id === "beacon"
      ? [["下载模块", "获得“深空扫描”"], ["出售坐标", "获得 18 信用点"]]
      : [["穿越风暴", "损失 6 舰体，获得 60 分"], ["支付燃料绕行", "损失 10 信用点"]];
  return <section className={`voyage-event-screen ${event.id}`}>
    <div className="voyage-event-art" aria-hidden="true"><span/><i/><b/></div>
    <div className="voyage-event-copy"><span>航行事件</span><strong>{event.title}</strong><p>{event.detail}</p><div>{choices.map((choice, index) => <button key={choice[0]} onClick={() => onChoose(index as 0 | 1)}><strong>{choice[0]}</strong><small>{choice[1]}</small></button>)}</div></div>
  </section>;
}

function VoyageShop({ state, onBuy, onLeave }: { state: VoyageState; onBuy: (key: string) => void; onLeave: () => void }) {
  return <section className="voyage-shop">
    <header><div><span>ORBITAL MARKET 19</span><strong>边境星港</strong></div><p>可用信用点 <b>{state.credits}</b></p></header>
    <div className="voyage-shop-grid">{state.shop.map((item) => {
      const title = item.kind === "card" ? VOYAGE_CARDS[item.cardId].name : item.kind === "relic" ? VOYAGE_RELICS[item.relicId].name : "紧急维修";
      const detail = item.kind === "card" ? VOYAGE_CARDS[item.cardId].detail : item.kind === "relic" ? VOYAGE_RELICS[item.relicId].detail : "恢复 18 点舰体完整度";
      return <article key={item.key} className={item.kind}>{item.kind === "card" ? <VoyageCardArt cardId={item.cardId}/> : <span className="voyage-shop-symbol">{item.kind === "repair" ? "+" : "✦"}</span>}<div><small>{item.kind === "card" ? "战术模块" : item.kind === "repair" ? "港口服务" : "稀有遗物"}</small><strong>{title}</strong><p>{detail}</p></div><button disabled={item.price > state.credits || (item.kind === "repair" && state.hull >= state.maxHull)} onClick={() => onBuy(item.key)}>{item.price} ¤</button></article>;
    })}</div>
    <button className="voyage-depart" onClick={onLeave}>离开星港 →</button>
  </section>;
}

function VoyageRepair({ state, onChoose }: { state: VoyageState; onChoose: (choice: "repair" | "remove") => void }) {
  return <section className="voyage-repair">
    <div className="voyage-repair-rings" aria-hidden="true"><i/><i/><i/><span>+</span></div>
    <header><span>MAINTENANCE ARRAY</span><strong>轨道维修平台</strong><p>自动化机械臂已经锁定晨星号。选择本次停靠的维护方案。</p></header>
    <div><button onClick={() => onChoose("repair")}><b>恢复舰体</b><span>恢复 {Math.ceil(state.maxHull * .3)} 点舰体完整度</span></button><button onClick={() => onChoose("remove")}><b>精简模块</b><span>移除一张基础卡，提高抽牌效率</span></button></div>
  </section>;
}

export default function StarVoyageGame({ active }: { active: boolean }) {
  const [restored] = useState(() => loadGameProgress<VoyageState>("voyage"));
  const [state, setState] = useState<VoyageState>(() => restored ?? createVoyageRun());
  const [started, setStarted] = useState(!!restored);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const resultRef = useRef("");
  const reachable = useMemo(() => new Set(reachableVoyageNodeIds(state)), [state]);

  const restart = () => {
    clearGameProgress("voyage");
    touchGame("voyage");
    setState(createVoyageRun());
    setStarted(false);
    setResultDismissed(false);
    setRestartConfirm(false);
    resultRef.current = "";
  };
  const update = (next: VoyageState, sound: "move" | "success" | "error" = "move") => {
    if (next === state) return;
    setState(next);
    setStarted(true);
    playNovaSound(sound);
  };

  useEffect(() => {
    touchGame("voyage");
    return subscribeGameReset("voyage", restart);
  }, []);
  useEffect(() => {
    if (started && state.phase !== "won" && state.phase !== "lost") saveGameProgress("voyage", state);
  }, [started, state]);
  useEffect(() => {
    if (state.phase !== "won" && state.phase !== "lost") return;
    if (resultRef.current === state.phase) return;
    resultRef.current = state.phase;
    finishGame("voyage", state.phase === "won" ? "win" : "loss");
    playNovaSound(state.phase === "won" ? "success" : "error");
  }, [state.phase]);
  useEffect(() => {
    if (!active || state.phase !== "combat") return;
    const shortcut = (event: KeyboardEvent) => {
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        update(playVoyageCard(state, Number(event.key) - 1));
      } else if (event.code === "Space") {
        event.preventDefault();
        update(endVoyageTurn(state));
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  return <main className="star-voyage">
    <header className="voyage-topbar">
      <div className="voyage-brand"><span><i>NV</i></span><div><strong>星港远征</strong><small>DEEP RANGE EXPEDITION</small></div></div>
      <div className="voyage-resource"><span>舰体 <b>{state.hull}/{state.maxHull}</b></span><span>信用点 <b>{state.credits}</b></span><span>航程分 <b>{state.score}</b></span></div>
      <button aria-label="重新开始远征" title="重新开始" onClick={() => started ? setRestartConfirm(true) : restart()}>↻</button>
    </header>
    <div className="voyage-stage">
      {state.phase === "map" && <VoyageMap state={state} onEnter={(nodeId) => reachable.has(nodeId) && update(enterVoyageNode(state, nodeId))}/>}
      {state.phase === "combat" && <VoyageCombat state={state} onPlay={(index) => update(playVoyageCard(state, index))} onEndTurn={() => update(endVoyageTurn(state))}/>}
      {state.phase === "reward" && <VoyageReward state={state} onChoose={(cardId) => update(chooseVoyageReward(state, cardId), "success")}/>}
      {state.phase === "event" && <VoyageEventScreen state={state} onChoose={(choice) => update(resolveVoyageEvent(state, choice), "success")}/>}
      {state.phase === "shop" && <VoyageShop state={state} onBuy={(key) => update(buyVoyageShopItem(state, key), "success")} onLeave={() => update(leaveVoyageShop(state))}/>}
      {state.phase === "repair" && <VoyageRepair state={state} onChoose={(choice) => update(resolveVoyageRepair(state, choice), "success")}/>}
      {(state.phase === "won" || state.phase === "lost") && <div className="voyage-final-scene"><EnemyShipArt art={state.phase === "won" ? "warden" : "raider"}/><strong>{state.phase === "won" ? "星门已经开放" : "晨星号失去响应"}</strong><span>航程得分 {state.score}</span></div>}
    </div>
    <footer className="voyage-log"><span>航行日志</span><div>{state.log.slice(0, 3).map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</div></footer>
    {restartConfirm && <div className="voyage-confirm-layer"><section role="dialog" aria-modal="true" aria-label="确认重新开始远征"><strong>放弃当前远征？</strong><p>当前星图、卡组和战斗进度将被替换。</p><div><button onClick={() => setRestartConfirm(false)}>取消</button><button className="danger" onClick={restart}>重新开始</button></div></section></div>}
    {(state.phase === "won" || state.phase === "lost") && !resultDismissed && <GameResultDialog tone={state.phase === "won" ? "win" : "loss"} title={state.phase === "won" ? "远征完成" : "远征终止"} detail={`${state.battlesWon} 场胜利 · ${state.score} 航程分`} onDismiss={() => setResultDismissed(true)} onRestart={restart}/>}
  </main>;
}
