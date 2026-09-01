"use client";

import "./calculator.css";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useWindowRuntime } from "../../platform/windows/WindowRuntime";
import {
  clearCalculatorHistory,
  createCalculatorState,
  formatCalculatorDisplay,
  pressCalculatorKey,
  restoreCalculatorHistory,
  type CalculatorHistoryEntry,
  type CalculatorKey,
  type CalculatorState,
} from "./calculatorCore";

const MEMORY_KEYS: CalculatorKey[] = ["MC", "MR", "M+", "M−", "MS"];
const KEYS: CalculatorKey[] = [
  "%", "CE", "C", "⌫",
  "1/x", "x²", "√x", "÷",
  "7", "8", "9", "×",
  "4", "5", "6", "−",
  "1", "2", "3", "+",
  "±", "0", ".", "=",
];

const KEY_LABELS: Partial<Record<CalculatorKey, string>> = {
  "⌫": "退格",
  "±": "切换正负号",
  "%": "百分比",
  "1/x": "倒数",
  "x²": "平方",
  "√x": "平方根",
  "÷": "除以",
  "×": "乘以",
  "−": "减去",
  "+": "加上",
  "=": "等于",
  "MC": "清除内存",
  "MR": "读取内存",
  "M+": "加到内存",
  "M−": "从内存减去",
  "MS": "存入内存",
};

const keyboardKey = (event: KeyboardEvent): CalculatorKey | null => {
  if (/^\d$/.test(event.key)) return event.key as CalculatorKey;
  if (event.key === "." || event.key === ",") return ".";
  if (event.key === "+") return "+";
  if (event.key === "-") return "−";
  if (event.key === "*") return "×";
  if (event.key === "/") return "÷";
  if (event.key === "%") return "%";
  if (event.key === "Enter" || event.key === "=") return "=";
  if (event.key === "Backspace") return "⌫";
  if (event.key === "Delete") return "CE";
  if (event.key === "Escape") return "C";
  return null;
};

type CalculatorAction =
  | { type: "key"; key: CalculatorKey }
  | { type: "clear-history" }
  | { type: "restore-history"; entry: CalculatorHistoryEntry };

const calculatorReducer = (state: CalculatorState, action: CalculatorAction) => {
  if (action.type === "clear-history") return clearCalculatorHistory(state);
  if (action.type === "restore-history") return restoreCalculatorHistory(state, action.entry);
  return pressCalculatorKey(state, action.key);
};

export default function CalculatorApp() {
  const active = useWindowRuntime().isAppActive("calculator");
  const [state, dispatch] = useReducer(
    calculatorReducer,
    undefined,
    createCalculatorState,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pressedKey, setPressedKey] = useState<CalculatorKey | null>(null);
  const pressedTimerRef = useRef<number | null>(null);

  const press = useCallback((key: CalculatorKey) => {
    dispatch({ type: "key", key });
    setPressedKey(key);
    if (pressedTimerRef.current) window.clearTimeout(pressedTimerRef.current);
    pressedTimerRef.current = window.setTimeout(() => setPressedKey(null), 120);
  }, []);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("textarea,[contenteditable=true]")) return;
      const key = keyboardKey(event);
      if (!key) return;
      event.preventDefault();
      press(key);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, press]);

  useEffect(() => () => {
    if (pressedTimerRef.current) window.clearTimeout(pressedTimerRef.current);
  }, []);

  const formattedDisplay = formatCalculatorDisplay(state.display);
  const displayLength = formattedDisplay.length;
  const displayClass = state.error
    ? "error"
    : displayLength > 18
      ? "small"
      : displayLength > 12
        ? "medium"
        : "";

  return <main className={`calculator ${historyOpen ? "history-open" : ""}`} aria-label="标准计算器">
    <header className="calculator-mode">
      <div>
        <span className="calculator-mark" aria-hidden="true">＋</span>
        <span><strong>标准</strong><small>STANDARD</small></span>
      </div>
      <button
        type="button"
        className={historyOpen ? "active" : ""}
        aria-label={historyOpen ? "关闭计算历史" : "打开计算历史"}
        aria-expanded={historyOpen}
        title="计算历史"
        onClick={() => setHistoryOpen((value) => !value)}
      >◷</button>
    </header>

    <section className="calculator-display" aria-live="polite">
      <div className="calculator-formula">{state.expression || "\u00a0"}</div>
      <div className="calculator-value">
        {state.memory !== 0 && <span title={`内存：${formatCalculatorDisplay(String(state.memory))}`}>M</span>}
        <output className={displayClass} title={formattedDisplay}>{formattedDisplay}</output>
      </div>
    </section>

    <div className="calculator-memory" role="group" aria-label="内存">
      {MEMORY_KEYS.map((key) => <button
        type="button"
        key={key}
        disabled={(key === "MC" || key === "MR") && state.memory === 0}
        className={pressedKey === key ? "pressed" : ""}
        aria-label={KEY_LABELS[key]}
        onClick={() => press(key)}
      >{key}</button>)}
    </div>

    <div className="calculator-keys">
      {KEYS.map((key) => {
        const operator = ["÷", "×", "−", "+"].includes(key);
        const utility = ["%", "CE", "C", "⌫", "1/x", "x²", "√x"].includes(key);
        return <button
          type="button"
          key={key}
          className={[
            operator ? "operator" : "",
            utility ? "utility" : "",
            key === "=" ? "equals" : "",
            state.pendingOperation === key ? "selected" : "",
            pressedKey === key ? "pressed" : "",
          ].filter(Boolean).join(" ")}
          aria-label={KEY_LABELS[key] ?? key}
          aria-pressed={operator ? state.pendingOperation === key : undefined}
          onClick={() => press(key)}
        >{key}</button>;
      })}
    </div>

    {historyOpen && <aside className="calculator-history-panel" aria-label="计算历史">
      <header><strong>历史</strong><button type="button" disabled={!state.history.length} onClick={() => dispatch({ type: "clear-history" })}>清空</button></header>
      <div>{state.history.length ? state.history.map((entry, index) => <button
        type="button"
        key={`${entry.expression}:${index}`}
        onClick={() => {
          dispatch({ type: "restore-history", entry });
          setHistoryOpen(false);
        }}
      ><span>{entry.expression} =</span><strong>{formatCalculatorDisplay(entry.result)}</strong></button>) : <p><span>◷</span><strong>暂无历史记录</strong><small>完成的计算会显示在这里</small></p>}</div>
    </aside>}
  </main>;
}
