import { describe, expect, it } from "vitest";
import {
  clearCalculatorHistory,
  createCalculatorState,
  formatCalculatorDisplay,
  pressCalculatorKey,
  restoreCalculatorHistory,
  type CalculatorKey,
} from "../../src/apps/calculator/calculatorCore";

const press = (keys: CalculatorKey[]) => (
  keys.reduce(pressCalculatorKey, createCalculatorState())
);

describe("calculatorCore", () => {
  it("evaluates basic and chained calculations", () => {
    expect(press(["1", "2", "+", "3", "="]).display).toBe("15");
    expect(press(["5", "+", "3", "×", "2", "="]).display).toBe("16");
  });

  it("repeats the previous operation when equals is pressed again", () => {
    const first = press(["5", "+", "2", "="]);
    const second = pressCalculatorKey(first, "=");

    expect(first.display).toBe("7");
    expect(second.display).toBe("9");
    expect(second.history).toHaveLength(2);
  });

  it("reports division by zero and resets on the next digit", () => {
    const error = press(["8", "÷", "0", "="]);
    const recovered = pressCalculatorKey(error, "7");

    expect(error.display).toBe("无法除以零");
    expect(recovered.display).toBe("7");
    expect(recovered.error).toBeNull();
  });

  it("supports percentages, unary operations and editing", () => {
    expect(press(["2", "0", "0", "+", "1", "0", "%", "="]).display).toBe("220");
    expect(press(["9", "√x"]).display).toBe("3");
    expect(press(["5", "x²"]).display).toBe("25");
    expect(press(["8", "7", "⌫"]).display).toBe("8");
  });

  it("stores, recalls and changes memory", () => {
    const stored = press(["5", "MS", "C", "MR", "M+", "M−"]);

    expect(stored.display).toBe("5");
    expect(stored.memory).toBe(5);
  });

  it("restores and clears history entries", () => {
    const calculated = press(["4", "×", "5", "="]);
    const restored = restoreCalculatorHistory(
      pressCalculatorKey(calculated, "C"),
      calculated.history[0],
    );

    expect(restored.display).toBe("20");
    expect(restored.expression).toBe("4 × 5 =");
    expect(clearCalculatorHistory(restored).history).toEqual([]);
  });

  it("formats long values without changing the calculation value", () => {
    expect(formatCalculatorDisplay("1234567.50")).toBe("1,234,567.50");
    expect(formatCalculatorDisplay("-9876")).toBe("−9,876");
    expect(formatCalculatorDisplay("无法除以零")).toBe("无法除以零");
  });
});
