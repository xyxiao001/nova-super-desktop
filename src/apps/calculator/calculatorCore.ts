export type CalculatorOperation = "+" | "−" | "×" | "÷";

export type CalculatorHistoryEntry = {
  expression: string;
  result: string;
};

export type CalculatorState = {
  display: string;
  accumulator: number | null;
  pendingOperation: CalculatorOperation | null;
  waitingForOperand: boolean;
  expression: string;
  lastOperation: CalculatorOperation | null;
  lastOperand: number | null;
  memory: number;
  history: CalculatorHistoryEntry[];
  error: string | null;
};

export type CalculatorKey =
  | `${number}`
  | "."
  | "C"
  | "CE"
  | "⌫"
  | "±"
  | "%"
  | "1/x"
  | "x²"
  | "√x"
  | CalculatorOperation
  | "="
  | "MC"
  | "MR"
  | "M+"
  | "M−"
  | "MS";

const OPERATIONS: CalculatorOperation[] = ["+", "−", "×", "÷"];
const MAX_DIGITS = 15;

export const createCalculatorState = (): CalculatorState => ({
  display: "0",
  accumulator: null,
  pendingOperation: null,
  waitingForOperand: true,
  expression: "",
  lastOperation: null,
  lastOperand: null,
  memory: 0,
  history: [],
  error: null,
});

const serializeNumber = (value: number) => {
  if (Object.is(value, -0)) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1e12 || (absolute > 0 && absolute < 1e-9)) {
    return value.toExponential(8).replace(/\.?0+e/, "e");
  }
  return String(Number.parseFloat(value.toPrecision(12)));
};

const applyOperation = (
  left: number,
  right: number,
  operation: CalculatorOperation,
) => {
  if (operation === "+") return left + right;
  if (operation === "−") return left - right;
  if (operation === "×") return left * right;
  return right === 0 ? null : left / right;
};

const resetCalculation = (state: CalculatorState): CalculatorState => ({
  ...createCalculatorState(),
  memory: state.memory,
  history: state.history,
});

const errorState = (
  state: CalculatorState,
  message: string,
  expression = state.expression,
): CalculatorState => ({
  ...state,
  display: message,
  accumulator: null,
  pendingOperation: null,
  waitingForOperand: true,
  expression,
  lastOperation: null,
  lastOperand: null,
  error: message,
});

const calculateResult = (
  state: CalculatorState,
  left: number,
  right: number,
  operation: CalculatorOperation,
  expression: string,
) => {
  const result = applyOperation(left, right, operation);
  if (result === null) return errorState(state, "无法除以零", `${expression} =`);
  if (!Number.isFinite(result)) return errorState(state, "结果溢出", `${expression} =`);
  return { result, display: serializeNumber(result) };
};

const inputDigit = (state: CalculatorState, digit: string): CalculatorState => {
  const working = state.error ? resetCalculation(state) : state;
  const digits = working.display.replace(/\D/g, "").length;
  if (!working.waitingForOperand && digits >= MAX_DIGITS) return working;
  const display = working.waitingForOperand || working.display === "0"
    ? digit
    : `${working.display}${digit}`;
  return {
    ...working,
    display,
    waitingForOperand: false,
    expression: working.pendingOperation ? working.expression : "",
    lastOperation: working.pendingOperation ? working.lastOperation : null,
    lastOperand: working.pendingOperation ? working.lastOperand : null,
  };
};

const inputDecimal = (state: CalculatorState): CalculatorState => {
  const working = state.error ? resetCalculation(state) : state;
  if (!working.waitingForOperand && working.display.includes(".")) return working;
  return {
    ...working,
    display: working.waitingForOperand ? "0." : `${working.display}.`,
    waitingForOperand: false,
    expression: working.pendingOperation ? working.expression : "",
    lastOperation: working.pendingOperation ? working.lastOperation : null,
    lastOperand: working.pendingOperation ? working.lastOperand : null,
  };
};

const chooseOperation = (
  state: CalculatorState,
  operation: CalculatorOperation,
): CalculatorState => {
  if (state.error) return state;
  if (state.pendingOperation && state.accumulator !== null && state.waitingForOperand) {
    return {
      ...state,
      pendingOperation: operation,
      expression: `${serializeNumber(state.accumulator)} ${operation}`,
    };
  }

  const current = Number(state.display);
  let accumulator = current;
  let display = state.display;
  if (state.pendingOperation && state.accumulator !== null) {
    const calculated = calculateResult(
      state,
      state.accumulator,
      current,
      state.pendingOperation,
      `${serializeNumber(state.accumulator)} ${state.pendingOperation} ${state.display}`,
    );
    if ("error" in calculated) return calculated;
    accumulator = calculated.result;
    display = calculated.display;
  }
  return {
    ...state,
    display,
    accumulator,
    pendingOperation: operation,
    waitingForOperand: true,
    expression: `${serializeNumber(accumulator)} ${operation}`,
    lastOperation: null,
    lastOperand: null,
  };
};

const evaluate = (state: CalculatorState): CalculatorState => {
  if (state.error) return state;
  const operation = state.pendingOperation ?? state.lastOperation;
  if (!operation) return state;
  const left = state.pendingOperation && state.accumulator !== null
    ? state.accumulator
    : Number(state.display);
  const right = state.pendingOperation
    ? Number(state.display)
    : state.lastOperand;
  if (right === null) return state;

  const expression = `${serializeNumber(left)} ${operation} ${serializeNumber(right)}`;
  const calculated = calculateResult(state, left, right, operation, expression);
  if ("error" in calculated) return calculated;
  const entry = { expression, result: calculated.display };
  return {
    ...state,
    display: calculated.display,
    accumulator: null,
    pendingOperation: null,
    waitingForOperand: true,
    expression: `${expression} =`,
    lastOperation: operation,
    lastOperand: right,
    history: [entry, ...state.history].slice(0, 12),
  };
};

const applyUnary = (
  state: CalculatorState,
  key: "1/x" | "x²" | "√x",
): CalculatorState => {
  if (state.error) return state;
  const current = Number(state.display);
  if (key === "1/x" && current === 0) {
    return errorState(state, "无法除以零", `1 / (${state.display})`);
  }
  if (key === "√x" && current < 0) {
    return errorState(state, "无效输入", `√(${state.display})`);
  }
  const result = key === "1/x" ? 1 / current : key === "x²" ? current ** 2 : Math.sqrt(current);
  if (!Number.isFinite(result)) return errorState(state, "结果溢出");
  const display = serializeNumber(result);
  const symbol = key === "1/x" ? "1/" : key === "x²" ? "平方" : "√";
  return {
    ...state,
    display,
    waitingForOperand: false,
    expression: state.pendingOperation
      ? `${serializeNumber(state.accumulator ?? 0)} ${state.pendingOperation} ${display}`
      : `${symbol}(${state.display})`,
    lastOperation: null,
    lastOperand: null,
  };
};

const recallMemory = (state: CalculatorState): CalculatorState => ({
  ...(state.error ? resetCalculation(state) : state),
  display: serializeNumber(state.memory),
  waitingForOperand: false,
  error: null,
});

export function pressCalculatorKey(
  state: CalculatorState,
  key: CalculatorKey,
): CalculatorState {
  if (/^\d$/.test(key)) return inputDigit(state, key);
  if (key === ".") return inputDecimal(state);
  if (key === "C") return resetCalculation(state);
  if (key === "CE") {
    if (state.error) return resetCalculation(state);
    return { ...state, display: "0", waitingForOperand: true, error: null };
  }
  if (key === "⌫") {
    if (state.error) return resetCalculation(state);
    if (state.waitingForOperand) return state;
    const display = state.display.length <= 1 || /^-\d$/.test(state.display)
      ? "0"
      : state.display.slice(0, -1);
    return { ...state, display, waitingForOperand: display === "0" };
  }
  if (key === "±") {
    if (state.error || Number(state.display) === 0) return state;
    return {
      ...state,
      display: state.display.startsWith("-") ? state.display.slice(1) : `-${state.display}`,
      waitingForOperand: false,
    };
  }
  if (key === "%") {
    if (state.error) return state;
    const current = Number(state.display);
    const value = state.accumulator !== null
      && (state.pendingOperation === "+" || state.pendingOperation === "−")
      ? state.accumulator * current / 100
      : current / 100;
    const display = serializeNumber(value);
    return {
      ...state,
      display,
      waitingForOperand: false,
      expression: state.pendingOperation
        ? `${serializeNumber(state.accumulator ?? 0)} ${state.pendingOperation} ${display}`
        : `${state.display}%`,
    };
  }
  if (key === "1/x" || key === "x²" || key === "√x") return applyUnary(state, key);
  if (OPERATIONS.includes(key as CalculatorOperation)) {
    return chooseOperation(state, key as CalculatorOperation);
  }
  if (key === "=") return evaluate(state);
  if (key === "MC") return { ...state, memory: 0 };
  if (key === "MR") return recallMemory(state);
  if (key === "MS") return { ...state, memory: state.error ? state.memory : Number(state.display) };
  if (key === "M+") return { ...state, memory: state.memory + (state.error ? 0 : Number(state.display)) };
  if (key === "M−") return { ...state, memory: state.memory - (state.error ? 0 : Number(state.display)) };
  return state;
}

export const clearCalculatorHistory = (state: CalculatorState): CalculatorState => ({
  ...state,
  history: [],
});

export const restoreCalculatorHistory = (
  state: CalculatorState,
  entry: CalculatorHistoryEntry,
): CalculatorState => ({
  ...state,
  display: entry.result,
  accumulator: null,
  pendingOperation: null,
  waitingForOperand: true,
  expression: `${entry.expression} =`,
  lastOperation: null,
  lastOperand: null,
  error: null,
});

export const formatCalculatorDisplay = (display: string) => {
  if (!/^-?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(display) || /e/i.test(display)) return display;
  const negative = display.startsWith("-");
  const [integer, fraction] = (negative ? display.slice(1) : display).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
};
