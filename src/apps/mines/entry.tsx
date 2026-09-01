"use client";

import "./mines.css";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import GameResultDialog from "../games/shared/GameResultDialog";
import {
  clearGameProgress,
  finishGame,
  loadGameProgress,
  saveGameProgress,
  subscribeGameReset,
  touchGame,
} from "../games/shared/gameStorage";
import { playNovaSound } from "../../../app/novaSettings";
import {
  DESKTOP_ICON_LONG_PRESS_MS,
  isCompactDesktopViewport,
  movedBeyondLongPressTolerance,
} from "../../../app/desktopIconInteraction";

type MineCell = { mine: boolean; revealed: boolean; flagged: boolean; nearby: number };
type MineDifficulty = "beginner" | "intermediate" | "expert";
type MineProgress = { difficulty: MineDifficulty; board: MineCell[]; elapsed: number; startedAt: number };

const MINE_LEVELS: Record<MineDifficulty, { label: string; rows: number; columns: number; mines: number }> = {
  beginner: { label: "初级", rows: 9, columns: 9, mines: 10 },
  intermediate: { label: "中级", rows: 16, columns: 16, mines: 40 },
  expert: { label: "高级", rows: 16, columns: 30, mines: 99 },
};

function mineNeighbors(index: number, rows: number, columns: number) {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const neighbors: number[] = [];
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      const nextRow = row + y;
      const nextColumn = column + x;
      if ((x || y) && nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns) neighbors.push(nextRow * columns + nextColumn);
    }
  }
  return neighbors;
}

function makeMineBoard(level: MineDifficulty, safeIndex?: number, seed = 1): MineCell[] {
  const config = MINE_LEVELS[level];
  const length = config.rows * config.columns;
  const empty = Array.from({ length }, () => ({ mine: false, revealed: false, flagged: false, nearby: 0 }));
  if (safeIndex === undefined) return empty;
  let value = seed || 1;
  const random = () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
  const excluded = new Set([safeIndex, ...mineNeighbors(safeIndex, config.rows, config.columns)]);
  const candidates = Array.from({ length }, (_, index) => index).filter((index) => !excluded.has(index));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  const mines = new Set(candidates.slice(0, config.mines));
  return empty.map((cell, index) => ({
    ...cell,
    mine: mines.has(index),
    nearby: mineNeighbors(index, config.rows, config.columns).filter((neighbor) => mines.has(neighbor)).length,
  }));
}

export default function MinesweeperGame() {
  const [restored] = useState(() => loadGameProgress<MineProgress>("mines"));
  const [difficulty, setDifficulty] = useState<MineDifficulty>(() => restored?.difficulty ?? ((localStorage.getItem("nova-mines-difficulty") as MineDifficulty) || "beginner"));
  const [board, setBoard] = useState(() => restored?.board ?? makeMineBoard(difficulty));
  const [status, setStatus] = useState<"ready" | "playing" | "won" | "lost">(restored ? "playing" : "ready");
  const [startedAt, setStartedAt] = useState<number | null>(restored?.startedAt ?? null);
  const [elapsed, setElapsed] = useState(restored?.elapsed ?? 0);
  const [bestTimes, setBestTimes] = useState<Partial<Record<MineDifficulty, number>>>(() => {
    const saved = localStorage.getItem("nova-mines-best");
    return saved ? JSON.parse(saved) : {};
  });
  const [resultDismissed, setResultDismissed] = useState(false);
  const cellPressRef = useRef<{ index: number; x: number; y: number; timer: number } | null>(null);
  const longPressedCellRef = useRef<number | null>(null);
  const config = MINE_LEVELS[difficulty];
  const flags = board.filter((cell) => cell.flagged).length;

  useEffect(() => {
    if (status !== "playing" || !startedAt) return;
    const tick = () => setElapsed(Math.min(999, Math.floor((Date.now() - startedAt) / 1000)));
    const timer = setInterval(tick, 250);
    tick();
    return () => clearInterval(timer);
  }, [startedAt, status]);
  useEffect(() => {
    touchGame("mines");
  }, []);
  useEffect(() => {
    if (status === "playing" && startedAt) saveGameProgress<MineProgress>("mines", { difficulty, board, elapsed, startedAt });
  }, [board, difficulty, elapsed, startedAt, status]);
  useEffect(() => subscribeGameReset("mines", () => reset(difficulty)), [difficulty]);

  function reset(level = difficulty) {
    clearGameProgress("mines");
    touchGame("mines");
    setDifficulty(level);
    localStorage.setItem("nova-mines-difficulty", level);
    setBoard(makeMineBoard(level));
    setStatus("ready");
    setResultDismissed(false);
    setStartedAt(null);
    setElapsed(0);
  }
  const finish = (next: MineCell[], start: number) => {
    if (next.some((cell) => cell.mine && cell.revealed)) {
      for (const cell of next) if (cell.mine) cell.revealed = true;
      finishGame("mines", "loss");
      playNovaSound("error");
      setStatus("lost");
      setResultDismissed(false);
      setStartedAt(null);
      setBoard(next);
      return;
    }
    if (next.every((cell) => cell.mine || cell.revealed)) {
      for (const cell of next) if (cell.mine) cell.flagged = true;
      const time = Math.min(999, Math.floor((Date.now() - start) / 1000));
      const best = bestTimes[difficulty];
      finishGame("mines", "win");
      playNovaSound("success");
      setElapsed(time);
      setStartedAt(null);
      setStatus("won");
      setResultDismissed(false);
      setBoard(next);
      if (best === undefined || time < best) {
        const updated = { ...bestTimes, [difficulty]: time };
        setBestTimes(updated);
        localStorage.setItem("nova-mines-best", JSON.stringify(updated));
      }
      return;
    }
    setBoard(next);
  };
  const revealTargets = (targets: number[]) => {
    if (status === "won" || status === "lost") return;
    const start = startedAt ?? Date.now();
    const next = (status === "ready" ? makeMineBoard(difficulty, targets[0], start) : board).map((cell, index) => ({ ...cell, flagged: board[index]?.flagged ?? false }));
    const queue = [...targets];
    const seen = new Set<number>();
    if (status === "ready") {
      setStartedAt(start);
      setStatus("playing");
    }
    while (queue.length) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const cell = next[current];
      if (!cell || cell.flagged || cell.revealed) continue;
      cell.revealed = true;
      if (cell.mine) break;
      if (cell.nearby === 0) queue.push(...mineNeighbors(current, config.rows, config.columns));
    }
    finish(next, start);
  };
  const reveal = (index: number) => {
    if (!board[index].flagged && !board[index].revealed) revealTargets([index]);
  };
  const chord = (index: number) => {
    const cell = board[index];
    if (status !== "playing" || !cell.revealed || !cell.nearby) return;
    const neighbors = mineNeighbors(index, config.rows, config.columns);
    if (neighbors.filter((neighbor) => board[neighbor].flagged).length === cell.nearby) revealTargets(neighbors.filter((neighbor) => !board[neighbor].flagged));
  };
  const toggleFlag = (index: number) => {
    if (status === "won" || status === "lost" || board[index].revealed) return;
    playNovaSound("move");
    setBoard((current) => current.map((cell, cellIndex) => cellIndex === index && (!cell.flagged && flags >= config.mines) ? cell : cellIndex === index ? { ...cell, flagged: !cell.flagged } : cell));
  };
  const clearCellPress = () => {
    if (cellPressRef.current) window.clearTimeout(cellPressRef.current.timer);
    cellPressRef.current = null;
  };
  const triggerCellFlag = (index: number) => {
    if (longPressedCellRef.current === index) return;
    clearCellPress();
    longPressedCellRef.current = index;
    toggleFlag(index);
  };
  const beginCellPress = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isCompactDesktopViewport() || event.button !== 0) return;
    clearCellPress();
    longPressedCellRef.current = null;
    const x = event.clientX;
    const y = event.clientY;
    cellPressRef.current = {
      index,
      x,
      y,
      timer: window.setTimeout(() => triggerCellFlag(index), DESKTOP_ICON_LONG_PRESS_MS),
    };
  };
  const moveCellPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = cellPressRef.current;
    if (press && movedBeyondLongPressTolerance(
      { x: press.x, y: press.y },
      { x: event.clientX, y: event.clientY },
    )) clearCellPress();
  };
  useEffect(() => () => {
    if (cellPressRef.current) window.clearTimeout(cellPressRef.current.timer);
  }, []);
  const face = status === "won" ? "😎" : status === "lost" ? "😵" : status === "playing" ? "🙂" : "😊";
  const statusText = status === "won" ? "雷区已清除" : status === "lost" ? "本局结束" : status === "playing" ? "进行中" : "准备开始";

  return <div className="minesweeper">
    <nav className="mine-difficulties" aria-label="扫雷难度">{(Object.keys(MINE_LEVELS) as MineDifficulty[]).map((level) => <button key={level} className={difficulty === level ? "active" : ""} aria-pressed={difficulty === level} onClick={() => reset(level)}>{MINE_LEVELS[level].label}<small>{MINE_LEVELS[level].columns}×{MINE_LEVELS[level].rows}</small></button>)}</nav>
    <header className="mine-score"><span><small>剩余</small><strong>{String(config.mines - flags).padStart(3, "0")}</strong></span><button aria-label="重新开始" title="重新开始" onClick={() => reset()}>{face}</button><span><small>用时</small><strong>{String(elapsed).padStart(3, "0")}</strong></span></header>
    <div className="mine-board" style={{ "--mine-columns": config.columns, "--mine-rows": config.rows } as React.CSSProperties}>{board.map((cell, index) => {
      const row = Math.floor(index / config.columns) + 1;
      const column = index % config.columns + 1;
      const label = cell.revealed ? (cell.mine ? "地雷" : cell.nearby ? `数字 ${cell.nearby}` : "空白") : cell.flagged ? "已标记" : "未翻开";
      return <button key={index} aria-label={`第 ${row} 行第 ${column} 列，${label}`} className={`${cell.revealed ? "revealed" : ""} ${cell.mine && cell.revealed ? "mine" : ""} n${cell.nearby}`} onPointerDown={(event) => beginCellPress(index, event)} onPointerMove={moveCellPress} onPointerUp={clearCellPress} onPointerCancel={clearCellPress} onClick={() => {
        if (longPressedCellRef.current === index) {
          longPressedCellRef.current = null;
          return;
        }
        reveal(index);
      }} onDoubleClick={() => chord(index)} onContextMenu={(event) => {
        event.preventDefault();
        if (isCompactDesktopViewport()) triggerCellFlag(index);
        else toggleFlag(index);
      }}>{cell.revealed ? (cell.mine ? "✹" : cell.nearby || "") : cell.flagged ? "⚑" : ""}</button>;
    })}</div>
    <footer><span>{statusText}</span><span>最佳 {bestTimes[difficulty] === undefined ? "---" : `${bestTimes[difficulty]}s`}</span></footer>
    {(status === "won" || status === "lost") && !resultDismissed && <GameResultDialog tone={status === "won" ? "win" : "loss"} title={status === "won" ? "雷区已清除" : "踩到地雷"} detail={status === "won" ? `${elapsed} 秒完成 ${config.label}难度` : "本局未能完成"} onDismiss={() => setResultDismissed(true)} onRestart={() => reset()}/>}
  </div>;
}
