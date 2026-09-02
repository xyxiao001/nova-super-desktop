"use client";

import "./wolfslot.css";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { playNovaSound } from "../../../app/novaSettings";
import {
  subscribeWindowClosing,
  useWindowInstance,
} from "../../platform/windows/WindowRuntime";
import {
  loadGameProgress,
  saveGameProgress,
  subscribeGameReset,
  touchGame,
} from "../games/shared/gameStorage";
import {
  awardGameCoins,
  readGameCoins,
  spendGameCoins,
  subscribeGameCoins,
} from "../games/shared/gameCoins";
import {
  calculateSlotPayout,
  createSlotOutcome,
  createTrainReward,
  getSlotSpinSteps,
  resolveSlotRound,
  settleSlotLossProtection,
  SLOT_LOSS_PROTECTION_TRIGGER,
  SLOT_PATH,
  type SlotLossProtection,
  type SlotOutcome,
  type SlotSymbolId,
} from "./wolfslotCore";

type SymbolId = Exclude<SlotSymbolId, "wolf">;
type BetMap = Record<SymbolId, number>;
type SlotProgress = {
  credits: number;
  bets: BetMap;
  lastBets: BetMap;
  roomMultiplier: number;
  lossProtection?: SlotLossProtection;
};

const SYMBOLS: { id: SymbolId; mark: string; label: string }[] = [
  { id: "bar", mark: "BAR", label: "BAR" },
  { id: "seven", mark: "7", label: "Seven" },
  { id: "star", mark: "★★", label: "双星" },
  { id: "melon", mark: "🍉", label: "西瓜" },
  { id: "bell", mark: "🔔", label: "铃铛" },
  { id: "plum", mark: "●", label: "李子" },
  { id: "orange", mark: "🍊", label: "橙子" },
  { id: "apple", mark: "🍎", label: "苹果" },
];
const PATH = SLOT_PATH;
const CELL_BADGES: Partial<Record<number, string>> = { 2:"×50", 3:"×120", 4:"×25", 8:"×3", 11:"×3", 14:"×3", 17:"×3", 20:"×3", 23:"×3" };
const EMPTY_BETS = Object.fromEntries(SYMBOLS.map((symbol) => [symbol.id, 0])) as Record<SymbolId, number>;
const cellPosition = (index: number) => {
  if (index < 7) return { row: 1, column: index + 1 };
  if (index < 12) return { row: index - 5, column: 7 };
  if (index < 19) return { row: 7, column: 19 - index };
  return { row: 25 - index, column: 1 };
};

export default function WolfSlotGame() {
  const windowInstance = useWindowInstance();
  const [restored] = useState(() => loadGameProgress<SlotProgress>("wolfslot"));
  const [coins, setCoins] = useState(readGameCoins);
  const [credits, setCredits] = useState(restored?.credits ?? 0);
  const [bets, setBets] = useState<BetMap>(restored?.bets ?? EMPTY_BETS);
  const [lastBets, setLastBets] = useState<BetMap>(restored?.lastBets ?? EMPTY_BETS);
  const [entered, setEntered] = useState(false);
  const [transferAmount, setTransferAmount] = useState(100);
  const [roomMultiplier, setRoomMultiplier] = useState(restored?.roomMultiplier ?? 1);
  const [selectedMultiplier, setSelectedMultiplier] = useState(restored?.roomMultiplier ?? 1);
  const [active, setActive] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState("选择图案下注，再按 GO");
  const [betUnit, setBetUnit] = useState(1);
  const [winnerIndices, setWinnerIndices] = useState<number[]>([]);
  const [specialOutcome, setSpecialOutcome] = useState<SlotOutcome | null>(null);
  const [trainRunning, setTrainRunning] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lossProtection, setLossProtection] = useState<SlotLossProtection>(
    restored?.lossProtection ?? { streak:0, accumulatedLoss:0 },
  );
  const timers = useRef<number[]>([]);
  const creditsRef = useRef(credits);
  const roomMultiplierRef = useRef(roomMultiplier);
  const totalBet = useMemo(() => Object.values(bets).reduce((sum, value) => sum + value, 0), [bets]);
  const lastBetTotal = useMemo(() => Object.values(lastBets).reduce((sum, value) => sum + value, 0), [lastBets]);
  const wagerUnit = betUnit * roomMultiplier;

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  const changeCredits = (amount: number) => {
    const next = creditsRef.current + amount;
    creditsRef.current = next;
    setCredits(next);
  };
  const reset = () => {
    clearTimers();
    if (creditsRef.current > 0) awardGameCoins(creditsRef.current);
    creditsRef.current = 0;
    setCredits(0);
    setEntered(false);
    setBets(EMPTY_BETS);
    setLastBets(EMPTY_BETS);
    setActive(0);
    setBonus(0);
    setSpinning(false);
    setBetUnit(1);
    setRoomMultiplier(1);
    setSelectedMultiplier(1);
    setWinnerIndices([]);
    setSpecialOutcome(null);
    setTrainRunning(false);
    setLastRoll(null);
    setLossProtection({ streak:0, accumulatedLoss:0 });
    setMessage("选择图案下注，再按 GO");
    touchGame("wolfslot");
  };

  useEffect(() => {
    touchGame("wolfslot");
    return subscribeGameReset("wolfslot", reset);
  }, []);
  useEffect(() => subscribeGameCoins(() => setCoins(readGameCoins())), []);
  useEffect(() => { creditsRef.current = credits; }, [credits]);
  useEffect(() => { roomMultiplierRef.current = roomMultiplier; }, [roomMultiplier]);
  useEffect(() => {
    saveGameProgress<SlotProgress>("wolfslot", { credits, bets, lastBets, roomMultiplier, lossProtection });
  }, [bets, credits, lastBets, lossProtection, roomMultiplier]);
  useEffect(() => subscribeWindowClosing(windowInstance.id, () => {
    const refundable = creditsRef.current;
    if (refundable > 0) awardGameCoins(refundable);
    creditsRef.current = 0;
    saveGameProgress<SlotProgress>("wolfslot", { credits: 0, bets: EMPTY_BETS, lastBets: EMPTY_BETS, roomMultiplier: roomMultiplierRef.current, lossProtection:{ streak:0, accumulatedLoss:0 } });
  }), [windowInstance.id]);
  useEffect(() => clearTimers, []);

  const scoreUp = () => {
    if (!spendGameCoins(transferAmount)) {
      setMessage("大厅金币不足，请先返回大厅重置");
      playNovaSound("error");
      return;
    }
    changeCredits(transferAmount);
    roomMultiplierRef.current = selectedMultiplier;
    setRoomMultiplier(selectedMultiplier);
    setBets(EMPTY_BETS);
    setLastBets(EMPTY_BETS);
    setLossProtection({ streak:0, accumulatedLoss:0 });
    setEntered(true);
    setMessage(`上分 ${transferAmount}，进入 ×${selectedMultiplier} 场`);
    playNovaSound("success");
  };
  const continueGame = () => {
    setEntered(true);
    setMessage("继续使用机内积分");
    playNovaSound("open");
  };
  const scoreDown = () => {
    if (spinning) return;
    if (credits > 0) awardGameCoins(credits);
    creditsRef.current = 0;
    setCredits(0);
    setBets(EMPTY_BETS);
    setLastBets(EMPTY_BETS);
    setBonus(0);
    setWinnerIndices([]);
    setSpecialOutcome(null);
    setLossProtection({ streak:0, accumulatedLoss:0 });
    setEntered(false);
    setMessage("已下分，积分退回游戏大厅");
    playNovaSound("success");
  };

  const addBet = (id: SymbolId) => {
    if (spinning) return;
    if (credits < totalBet + wagerUnit) {
      setMessage("机内积分不足，请先下分后重新上分");
      playNovaSound("error");
      return;
    }
    setWinnerIndices([]);
    setSpecialOutcome(null);
    setLastRoll(null);
    setBets((current) => ({ ...current, [id]: current[id] + wagerUnit }));
    playNovaSound("move");
  };
  const addAll = () => {
    if (spinning) return;
    const required = totalBet + SYMBOLS.length * wagerUnit;
    if (credits < required) {
      setMessage("机内积分不足，请先下分后重新上分");
      playNovaSound("error");
      return;
    }
    setWinnerIndices([]);
    setSpecialOutcome(null);
    setLastRoll(null);
    setBets((current) => Object.fromEntries(SYMBOLS.map(({ id }) => [id, current[id] + wagerUnit])) as Record<SymbolId, number>);
    setMessage(`×${roomMultiplier} 场 · 全部图案 +${wagerUnit}`);
    playNovaSound("move");
  };
  const changeBetUnit = (direction: number) => {
    if (spinning) return;
    const units = [1, 5, 10];
    setBetUnit((current) => units[Math.max(0, Math.min(units.length - 1, units.indexOf(current) + direction))]);
    playNovaSound("move");
  };
  const spin = () => {
    if (spinning) return;
    const round = resolveSlotRound(bets, lastBets);
    if (!round.total) {
      setMessage("先点击下方图案下注");
      playNovaSound("error");
      return;
    }
    if (credits < round.total) {
      setMessage("机内积分不足，请先下分后重新上分");
      playNovaSound("error");
      return;
    }
    changeCredits(-round.total);
    if (!round.repeated) setLastBets({ ...bets });
    setMessage(round.repeated ? `复投 ${round.total}，灯轮转动中…` : `下注 ${round.total}，灯轮转动中…`);
    setBonus(0);
    setSpinning(true);
    setWinnerIndices([]);
    setSpecialOutcome(null);
    setLastRoll(null);
    playNovaSound("open");
    const outcome = createSlotOutcome();
    const destination = outcome.landing;
    const steps = getSlotSpinSteps(active, destination);
    let position = active;
    const settleRound = (win: number, resultMessage: string) => {
      const settlement = settleSlotLossProtection(round.total, win, lossProtection);
      const protectedMessage = settlement.compensation > 0
        ? `${resultMessage} · 连输补偿 +${settlement.compensation}`
        : settlement.next.streak > 0
          ? `${resultMessage} · 连输保护 ${settlement.next.streak}/${SLOT_LOSS_PROTECTION_TRIGGER}`
          : resultMessage;
      setLossProtection(settlement.next);
      setBonus(win);
      if (win + settlement.compensation > 0) changeCredits(win + settlement.compensation);
      setBets(EMPTY_BETS);
      setSpinning(false);
      setMessage(protectedMessage);
      playNovaSound(win > 0 || settlement.compensation > 0 ? "success" : "error");
    };
    const finishOutcome = (resolved: SlotOutcome) => {
      if (resolved.kind === "eaten") {
        setActive(resolved.landing);
        setWinnerIndices([resolved.landing]);
        settleRound(0, "火车被狼吃掉了，本轮奖金归零");
        return;
      }
      setWinnerIndices([]);
      const revealDelay = resolved.targets.length > 8 ? 75 : 230;
      resolved.targets.forEach((target, targetIndex) => {
        const revealTimer = window.setTimeout(() => {
          if (resolved.special) setActive(target);
          setWinnerIndices((current) => [...current, target]);
          if (targetIndex !== resolved.targets.length - 1) {
            playNovaSound("move");
            return;
          }
          const win = calculateSlotPayout(round.bets, resolved.targets);
          const landed = PATH[target];
          const symbol = SYMBOLS.find((item) => item.id === landed)!;
          settleRound(win, resolved.special
            ? `${resolved.label}！${win ? `+${win} 积分` : "本轮未押中"}`
            : win ? `${symbol.label} 中奖！+${win} 积分` : `${symbol.label} 未下注，再来一次`);
        }, targetIndex * revealDelay);
        timers.current.push(revealTimer);
      });
    };
    const runTrain = () => {
      setSpecialOutcome(outcome);
      setWinnerIndices([outcome.landing]);
      setTrainRunning(true);
      setMessage("狼灯命中，开火车中…");
      const trainSteps = PATH.length + 8;
      for (let trainStep = 1; trainStep <= trainSteps; trainStep += 1) {
        const trainTimer = window.setTimeout(() => {
          setActive((outcome.landing + trainStep) % PATH.length);
          if (trainStep % 3 === 0) playNovaSound("move");
          if (trainStep !== trainSteps) return;
          setTrainRunning(false);
          const reward = createTrainReward(outcome.landing);
          setSpecialOutcome(reward);
          finishOutcome(reward);
        }, 420 + trainStep * 68);
        timers.current.push(trainTimer);
      }
    };
    for (let step = 1; step <= steps; step += 1) {
      const delay = step < steps - 8 ? step * 42 : (steps - 8) * 42 + (step - (steps - 8)) * 92;
      const timer = window.setTimeout(() => {
        position = (position + 1) % PATH.length;
        setActive(position);
        if (step !== steps) return;
        if (outcome.kind === "wolf") runTrain();
        else finishOutcome(outcome);
      }, delay);
      timers.current.push(timer);
    }
  };
  const guessSize = (choice: "small" | "big") => {
    if (spinning || bonus <= 0) return;
    const roll = 1 + Math.floor(Math.random() * 13);
    const won = choice === "small" ? roll <= 6 : roll >= 8;
    setLastRoll(roll);
    if (won) {
      changeCredits(bonus);
      setBonus((value) => value * 2);
      setMessage(`${roll} · 猜中！奖励翻倍`);
      playNovaSound("success");
      return;
    }
    changeCredits(-bonus);
    setBonus(0);
    setMessage(`${roll} · 未猜中，本次奖励归零`);
    playNovaSound("error");
  };

  return <main className="wolf-slot">
    <section className="slot-cabinet" aria-label="童年老虎机">
      <div className="slot-speaker" aria-hidden="true"><i/><i/><i/></div>
      <header className="slot-displays">
        <div className="slot-display"><small>BONUS-WIN</small><strong>{String(bonus).padStart(7, "0")}</strong></div>
        <div className="slot-display slot-credit-display"><small>CREDIT · ×{roomMultiplier} 场</small><strong>{String(credits).padStart(7, "0")}</strong><button type="button" onClick={scoreDown} disabled={spinning}>下分</button></div>
      </header>
      <div className="slot-feature-strip" aria-label="特别奖励"><span>开火车</span><span>大三元</span><span>小三元</span><span>大四喜</span><span>大满贯</span></div>

      <div className={`slot-board ${trainRunning ? "train-running" : ""}`}>
        {PATH.map((id, index) => {
          const symbol = id === "wolf" ? { id, mark:"", label:"狼" } : SYMBOLS.find((item) => item.id === id)!;
          const position = cellPosition(index);
          const variant = index === 2 ? "bar-red" : index === 3 ? "bar-black" : index === 4 ? "bar-blue" : id === "wolf" ? index === 21 ? "wolf-left" : "wolf-right" : "";
          return <div key={index} aria-label={symbol.label} className={`slot-cell symbol-${id} ${variant} ${active === index ? "active" : ""} ${winnerIndices.includes(index) ? "winner" : ""}`} style={{ "--row": position.row, "--column": position.column } as CSSProperties}>
            {id === "bar" ? <span className="bar-stack"><b>BAR</b><em>{CELL_BADGES[index]}</em><b>BAR</b></span> : <><span>{symbol.mark}</span>{CELL_BADGES[index] && <small>{CELL_BADGES[index]}</small>}</>}
          </div>;
        })}
        <div className="wolf-moon-stage">
          <img src="/assets/games/wolf-slot/wolf-moon.png" alt="满月下长啸的狼"/>
          <b>JP</b>
          <output>{spinning ? "--" : String(active + 1).padStart(2, "0")}</output>
          {specialOutcome && <div className={`slot-special-banner special-${specialOutcome.kind}`}><strong>{specialOutcome.label}</strong><small>{specialOutcome.detail}</small></div>}
        </div>
      </div>

      <div className="slot-controls">
        <button className="all-button" type="button" onClick={addAll}>ALL<small>+{wagerUnit}</small></button>
        <button className="arrow-button" type="button" aria-label="减少单注" onClick={() => changeBetUnit(-1)}>◀<small>押 {wagerUnit}</small></button>
        <button className="arrow-button" type="button" aria-label="增加单注" onClick={() => changeBetUnit(1)}>▶<small>押 {wagerUnit}</small></button>
        <button className="range-button" type="button" onClick={() => guessSize("small")} disabled={spinning || bonus <= 0}>1-6<small>小</small></button><button className="range-button" type="button" onClick={() => guessSize("big")} disabled={spinning || bonus <= 0}>8-13<small>大</small></button>
        <button className="go-button" type="button" onClick={spin} disabled={spinning}>GO{!totalBet && lastBetTotal > 0 && <small>复投 {lastBetTotal}</small>}</button>
      </div>

      <div className="slot-bet-panel">
        <div className="slot-paytable"><strong>120</strong><span>40</span><span>30</span><span>20</span><span>20</span><span>15</span><span>10</span><strong>5</strong></div>
        <div className="slot-bet-values">{SYMBOLS.map((symbol) => <output key={symbol.id}>{bets[symbol.id]}</output>)}</div>
        <div className="slot-bet-buttons">{SYMBOLS.map((symbol) => <button type="button" key={symbol.id} aria-label={`${symbol.label}下注 ${wagerUnit} 分`} className={`symbol-${symbol.id}`} onClick={() => addBet(symbol.id)}><span>{symbol.mark}</span></button>)}</div>
      </div>
      <p className="slot-message" role="status">{message}<span>{lastRoll ? `点数 ${lastRoll} · ` : ""}{totalBet ? `当前下注 ${totalBet}` : lastBetTotal ? `GO 复投 ${lastBetTotal}` : "当前下注 0"}</span></p>
      {!entered && <div className="slot-score-desk" role="dialog" aria-label="老虎机上分">
        <div className="slot-score-card">
          <span className="score-card-kicker">WOLF MOON · CREDIT</span>
          <h2>选择上分</h2>
          <div className="score-balances"><span>大厅金币<strong>{coins}</strong></span><span>机内积分<strong>{credits}</strong></span></div>
          <div className="score-stepper"><button type="button" aria-label="减少上分" onClick={() => setTransferAmount((value) => Math.max(10, value - 10))}>−</button><output>{transferAmount}</output><button type="button" aria-label="增加上分" onClick={() => setTransferAmount((value) => value + 10)}>＋</button></div>
          <div className="score-presets"><button type="button" onClick={() => setTransferAmount(50)}>50</button><button type="button" onClick={() => setTransferAmount(100)}>100</button><button type="button" onClick={() => setTransferAmount(200)}>200</button><button type="button" onClick={() => setTransferAmount(coins)}>全部</button></div>
          <div className="score-room"><span>选择积分倍率</span><div>{[1,2,5,10].map((multiplier) => <button type="button" key={multiplier} aria-pressed={selectedMultiplier === multiplier} onClick={() => setSelectedMultiplier(multiplier)}>×{multiplier}</button>)}</div><small>下注与中奖同步放大</small></div>
          <button className="score-enter" type="button" onClick={scoreUp} disabled={transferAmount <= 0}>上分并进入</button>
          {credits > 0 && <button className="score-continue" type="button" onClick={continueGame}>继续机内积分 {credits}</button>}
          <p>游戏只使用机内积分 · 下分后退回大厅金币</p>
        </div>
      </div>}
    </section>
  </main>;
}
