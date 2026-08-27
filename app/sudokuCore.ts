export type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";
export type SudokuStatus = "playing" | "won" | "lost";

export type SudokuState = {
  puzzle: string;
  solution: string;
  difficulty: SudokuDifficulty;
  values: (number | null)[];
  notes: Record<string, number[]>;
  mistakes: number;
  hints: number;
  status: SudokuStatus;
};

export type SudokuInputResult = {
  state: SudokuState;
  changed: boolean;
  correct: boolean | null;
};

export function createSudokuState(
  puzzle: string,
  solution: string,
  difficulty: SudokuDifficulty,
): SudokuState {
  if (puzzle.length !== 81 || solution.length !== 81) {
    throw new Error("数独题面必须包含 81 个单元格");
  }
  return {
    puzzle,
    solution,
    difficulty,
    values: Array<number | null>(81).fill(null),
    notes: {},
    mistakes: 0,
    hints: 0,
    status: "playing",
  };
}

export function sudokuGiven(state: SudokuState, index: number) {
  const value = state.puzzle[index];
  return value === "-" ? null : Number(value);
}

export function sudokuSolution(state: SudokuState, index: number) {
  return Number(state.solution[index]);
}

export function sudokuValue(state: SudokuState, index: number) {
  return sudokuGiven(state, index) ?? state.values[index];
}

export function sudokuPeers(index: number) {
  const row = Math.floor(index / 9);
  const column = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  const peers = new Set<number>();
  for (let offset = 0; offset < 9; offset += 1) {
    peers.add(row * 9 + offset);
    peers.add(offset * 9 + column);
  }
  for (let y = boxRow; y < boxRow + 3; y += 1) {
    for (let x = boxColumn; x < boxColumn + 3; x += 1) peers.add(y * 9 + x);
  }
  peers.delete(index);
  return [...peers];
}

export function applySudokuInput(
  state: SudokuState,
  index: number,
  digit: number,
  noteMode: boolean,
): SudokuInputResult {
  if (
    state.status !== "playing"
    || sudokuGiven(state, index) !== null
    || state.values[index] === sudokuSolution(state, index)
    || digit < 1
    || digit > 9
  ) {
    return { state, changed: false, correct: null };
  }
  if (noteMode && sudokuValue(state, index) === null) {
    const current = state.notes[index] ?? [];
    const notes = current.includes(digit)
      ? current.filter((value) => value !== digit)
      : [...current, digit].sort();
    return {
      state: { ...state, notes: { ...state.notes, [index]: notes } },
      changed: true,
      correct: null,
    };
  }
  const correct = sudokuSolution(state, index) === digit;
  const mistakes = state.mistakes + (correct ? 0 : 1);
  const values = [...state.values];
  values[index] = digit;
  const notes = { ...state.notes };
  delete notes[index];
  if (correct) {
    for (const peer of sudokuPeers(index)) {
      if (notes[peer]?.includes(digit)) {
        notes[peer] = notes[peer].filter((value) => value !== digit);
      }
    }
  }
  const complete = correct && values.every((value, cell) => (
    sudokuGiven(state, cell) !== null || value === sudokuSolution(state, cell)
  ));
  return {
    state: {
      ...state,
      values,
      notes,
      mistakes,
      status: mistakes >= 3 ? "lost" : complete ? "won" : "playing",
    },
    changed: true,
    correct,
  };
}

export function clearSudokuCell(state: SudokuState, index: number) {
  if (
    state.status !== "playing"
    || sudokuGiven(state, index) !== null
    || state.values[index] === sudokuSolution(state, index)
  ) return state;
  const values = [...state.values];
  values[index] = null;
  const notes = { ...state.notes };
  delete notes[index];
  return { ...state, values, notes };
}

export function revealSudokuHint(state: SudokuState, selectedIndex?: number) {
  if (state.status !== "playing" || state.hints >= 3) return state;
  const selected = selectedIndex !== undefined
    && sudokuGiven(state, selectedIndex) === null
    && sudokuValue(state, selectedIndex) !== sudokuSolution(state, selectedIndex)
    ? selectedIndex
    : undefined;
  const index = selected ?? state.values.findIndex((value, cell) => (
    sudokuGiven(state, cell) === null && value !== sudokuSolution(state, cell)
  ));
  if (index < 0) return state;
  const result = applySudokuInput(state, index, sudokuSolution(state, index), false).state;
  return { ...result, hints: state.hints + 1 };
}
