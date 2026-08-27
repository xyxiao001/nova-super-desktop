import { describe, expect, it } from "vitest";

import {
  applySudokuInput,
  clearSudokuCell,
  createSudokuState,
  revealSudokuHint,
  sudokuPeers,
  sudokuValue,
} from "../../app/sudokuCore";

const SOLUTION = "123456789".repeat(9);

describe("sudoku core", () => {
  it("identifies the 20 unique row, column, and box peers", () => {
    const peers = sudokuPeers(40);

    expect(peers).toHaveLength(20);
    expect(peers).toContain(36);
    expect(peers).toContain(4);
    expect(peers).toContain(30);
  });

  it("toggles notes and removes a solved digit from peer notes", () => {
    let state = createSudokuState(`--${SOLUTION.slice(2)}`, SOLUTION, "easy");
    state = applySudokuInput(state, 1, 1, true).state;
    expect(state.notes[1]).toEqual([1]);

    state = applySudokuInput(state, 0, 1, false).state;
    expect(state.notes[1]).toEqual([]);
    expect(sudokuValue(state, 0)).toBe(1);
  });

  it("ends the game after three incorrect entries", () => {
    let state = createSudokuState(`-${SOLUTION.slice(1)}`, SOLUTION, "medium");
    state = applySudokuInput(state, 0, 2, false).state;
    state = applySudokuInput(state, 0, 3, false).state;
    state = applySudokuInput(state, 0, 4, false).state;

    expect(state.mistakes).toBe(3);
    expect(state.status).toBe("lost");
  });

  it("wins when the final empty cell is solved", () => {
    const state = createSudokuState(`-${SOLUTION.slice(1)}`, SOLUTION, "hard");
    const result = applySudokuInput(state, 0, 1, false);

    expect(result.correct).toBe(true);
    expect(result.state.status).toBe("won");
  });

  it("keeps a correctly solved editable cell locked", () => {
    let state = createSudokuState(`--${SOLUTION.slice(2)}`, SOLUTION, "easy");
    state = applySudokuInput(state, 0, 1, false).state;

    expect(applySudokuInput(state, 0, 2, false).changed).toBe(false);
    expect(clearSudokuCell(state, 0)).toBe(state);
  });

  it("clears editable cells and reveals at most three hints", () => {
    let state = createSudokuState(`---${SOLUTION.slice(3)}`, SOLUTION, "expert");
    state = applySudokuInput(state, 0, 2, false).state;
    state = clearSudokuCell(state, 0);
    expect(sudokuValue(state, 0)).toBeNull();

    state = revealSudokuHint(state, 0);
    state = revealSudokuHint(state);
    state = revealSudokuHint(state);
    const unchanged = revealSudokuHint(state);
    expect(state.hints).toBe(3);
    expect(unchanged).toBe(state);
  });
});
