"use client";

import "./games-tools.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSudoku } from "sudoku-gen";

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
  applySudokuInput,
  clearSudokuCell,
  createSudokuState,
  revealSudokuHint,
  sudokuGiven,
  sudokuPeers,
  sudokuSolution,
  sudokuValue,
  type SudokuDifficulty,
  type SudokuState,
} from "./sudokuCore";

type SudokuProgress = {
  game: SudokuState;
  elapsed: number;
};

const DIFFICULTIES: { id: SudokuDifficulty; label: string }[] = [
  { id: "easy", label: "简单" },
  { id: "medium", label: "中等" },
  { id: "hard", label: "困难" },
  { id: "expert", label: "专家" },
];

const newSudoku = (difficulty: SudokuDifficulty) => {
  const generated = getSudoku(difficulty);
  return createSudokuState(generated.puzzle, generated.solution, generated.difficulty);
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function SudokuGame({ active }: { active: boolean }) {
  const [restored] = useState(() => loadGameProgress<SudokuProgress>("sudoku"));
  const [game, setGame] = useState<SudokuState>(() => restored?.game ?? newSudoku("easy"));
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [started, setStarted] = useState(!!restored);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(restored?.elapsed ?? 0);
  const [resultDismissed, setResultDismissed] = useState(false);
  const resultRef = useRef("");

  const selectedValue = selected === null ? null : sudokuValue(game, selected);
  const peers = useMemo(() => new Set(selected === null ? [] : sudokuPeers(selected)), [selected]);
  const filled = Array.from({ length: 81 }, (_, index) => index).filter((index) => (
    sudokuValue(game, index) === sudokuSolution(game, index)
  )).length;

  const restart = (difficulty = game.difficulty) => {
    resultRef.current = "";
    clearGameProgress("sudoku");
    touchGame("sudoku");
    setGame(newSudoku(difficulty));
    setSelected(null);
    setNoteMode(false);
    setStarted(false);
    setPaused(false);
    setElapsed(0);
    setResultDismissed(false);
  };

  const enterDigit = (digit: number) => {
    if (selected === null || paused) return;
    const result = applySudokuInput(game, selected, digit, noteMode);
    if (!result.changed) return;
    setStarted(true);
    setGame(result.state);
    if (result.correct === false) playNovaSound("error");
    else playNovaSound("move");
  };

  const clearSelected = () => {
    if (selected === null || paused) return;
    setGame((current) => clearSudokuCell(current, selected));
  };

  const useHint = () => {
    if (paused || game.hints >= 3) return;
    const next = revealSudokuHint(game, selected ?? undefined);
    if (next !== game) {
      setStarted(true);
      setGame(next);
      playNovaSound("success");
    }
  };

  useEffect(() => {
    touchGame("sudoku");
    return subscribeGameReset("sudoku", () => restart(game.difficulty));
  }, [game.difficulty]);

  useEffect(() => {
    if (!started || game.status !== "playing" || paused) return;
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [game.status, paused, started]);

  useEffect(() => {
    if (started && game.status === "playing") saveGameProgress<SudokuProgress>("sudoku", { game, elapsed });
  }, [elapsed, game, started]);

  useEffect(() => {
    if (game.status === "playing") return;
    const key = `${game.status}:${elapsed}`;
    if (resultRef.current === key) return;
    resultRef.current = key;
    finishGame("sudoku", game.status === "won" ? "win" : "loss");
    playNovaSound(game.status === "won" ? "success" : "error");
  }, [elapsed, game.status]);

  useEffect(() => {
    if (!active) return;
    const handleKey = (event: KeyboardEvent) => {
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        enterDigit(Number(event.key));
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        clearSelected();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNoteMode((current) => !current);
      } else if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        useHint();
      } else if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (started && game.status === "playing") setPaused((current) => !current);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return <main className="sudoku-game">
    <header className="sudoku-toolbar">
      <div className="sudoku-difficulties" role="group" aria-label="数独难度">
        {DIFFICULTIES.map((difficulty) => <button key={difficulty.id} className={game.difficulty === difficulty.id ? "active" : ""} aria-pressed={game.difficulty === difficulty.id} onClick={() => restart(difficulty.id)}>{difficulty.label}</button>)}
      </div>
      <div className="sudoku-status"><span>错误 <b>{game.mistakes}/3</b></span><strong>{formatTime(elapsed)}</strong><span>提示 <b>{3 - game.hints}</b></span></div>
      <div className="sudoku-window-actions"><button aria-label={paused ? "继续游戏" : "暂停游戏"} title={paused ? "继续" : "暂停"} disabled={!started || game.status !== "playing"} onClick={() => setPaused(!paused)}>{paused ? "▶" : "Ⅱ"}</button><button aria-label="新游戏" title="新游戏" onClick={() => restart()}>↻</button></div>
    </header>
    <section className="sudoku-layout">
      <div className="sudoku-board" aria-label="数独棋盘">
        {Array.from({ length: 81 }, (_, index) => {
          const value = sudokuValue(game, index);
          const given = sudokuGiven(game, index) !== null;
          const wrong = !given && value !== null && value !== sudokuSolution(game, index);
          const related = peers.has(index);
          const same = selectedValue !== null && value === selectedValue;
          const notes = game.notes[index] ?? [];
          return <button key={index} disabled={paused || game.status !== "playing"} aria-label={`第 ${Math.floor(index / 9) + 1} 行第 ${index % 9 + 1} 列${value ? `，数字 ${value}` : notes.length ? `，笔记 ${notes.join("、")}` : "，空白"}`} className={`${given ? "given" : ""} ${selected === index ? "selected" : ""} ${related ? "related" : ""} ${same ? "same" : ""} ${wrong ? "wrong" : ""}`} onClick={() => setSelected(index)}>
            {value ?? <span className="sudoku-notes">{Array.from({ length: 9 }, (_, note) => <i key={note}>{notes.includes(note + 1) ? note + 1 : ""}</i>)}</span>}
          </button>;
        })}
        {paused && <div className="sudoku-paused"><span>Ⅱ</span><strong>已暂停</strong><button onClick={() => setPaused(false)}>继续</button></div>}
      </div>
      <aside className="sudoku-panel">
        <div className="sudoku-progress"><span><i style={{ width: `${Math.round(filled / 81 * 100)}%` }}/></span><small>{filled}/81</small></div>
        <div className="sudoku-number-pad">{Array.from({ length: 9 }, (_, index) => <button key={index + 1} disabled={paused || game.status !== "playing"} onClick={() => enterDigit(index + 1)}>{index + 1}</button>)}</div>
        <div className="sudoku-tools">
          <button className={noteMode ? "active" : ""} aria-pressed={noteMode} disabled={paused || game.status !== "playing"} onClick={() => setNoteMode(!noteMode)}><span>✎</span>笔记</button>
          <button disabled={paused || selected === null || game.status !== "playing"} onClick={clearSelected}><span>⌫</span>清除</button>
          <button disabled={paused || game.hints >= 3 || game.status !== "playing"} onClick={useHint}><span>◇</span>提示</button>
        </div>
        <section className="sudoku-rule"><strong>规则</strong><p>每行、每列和每个九宫格都填入 1 至 9，数字不能重复。</p></section>
      </aside>
    </section>
    {game.status !== "playing" && !resultDismissed && <GameResultDialog tone={game.status === "won" ? "win" : "loss"} title={game.status === "won" ? "数独完成" : "失误次数已用完"} detail={game.status === "won" ? `${formatTime(elapsed)} · 使用 ${game.hints} 次提示` : "本局已记录，可以重新挑战同一难度"} onDismiss={() => setResultDismissed(true)} onRestart={() => restart()}/>}
  </main>;
}
