"use client";

import { useState } from "react";

export default function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [replace, setReplace] = useState(true);
  const [formula, setFormula] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const calculate = (left: number, right: number, op: string) => op === "+" ? left + right : op === "−" ? left - right : op === "×" ? left * right : right === 0 ? 0 : left / right;
  const showOperand = (value: string) => setFormula(stored !== null && operation ? `${stored} ${operation} ${value}` : value);
  const press = (key: string) => {
    if (/^\d$/.test(key)) {
      const next = replace ? key : display === "0" ? key : display + key;
      setDisplay(next);
      showOperand(next);
      setReplace(false);
      return;
    }
    if (key === ".") {
      const next = replace ? "0." : display.includes(".") ? display : `${display}.`;
      setDisplay(next);
      showOperand(next);
      setReplace(false);
      return;
    }
    if (key === "C") {
      setDisplay("0");
      setStored(null);
      setOperation(null);
      setReplace(true);
      setFormula("");
      return;
    }
    if (key === "±") {
      const next = String(Number(display) * -1);
      setDisplay(next);
      showOperand(next);
      return;
    }
    if (key === "%") {
      const next = String(Number(display) / 100);
      setDisplay(next);
      showOperand(next);
      return;
    }
    if (["+", "−", "×", "÷"].includes(key)) {
      const current = Number(display);
      const next = stored !== null && operation && !replace ? calculate(stored, current, operation) : current;
      setStored(next);
      setDisplay(String(next));
      setOperation(key);
      setFormula(`${next} ${key}`);
      setReplace(true);
      return;
    }
    if (key === "=" && stored !== null && operation) {
      const result = calculate(stored, Number(display), operation);
      const line = `${stored} ${operation} ${display} = ${result}`;
      setFormula(`${stored} ${operation} ${display} =`);
      setHistory((current) => [line, ...current].slice(0, 4));
      setDisplay(String(result));
      setStored(null);
      setOperation(null);
      setReplace(true);
    }
  };

  return <div className="calculator"><header className="calculator-mode"><strong>标准</strong><button onClick={() => setHistory([])}>清除历史</button></header><div className="calculator-history">{history.length ? history.map((line, index) => <span key={`${line}-${index}`}>{line}</span>) : <span>暂无计算历史</span>}</div><div className="calculator-formula">{formula || " "}</div><output>{display}</output><div className="calculator-keys">{["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="].map((key) => <button key={key} className={`${["÷", "×", "−", "+", "="].includes(key) ? "operator" : ""} ${key === "0" ? "zero" : ""}`} onClick={() => press(key)}>{key}</button>)}</div></div>;
}
