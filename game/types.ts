/**
 * Imperative API exposed by PlinkoBoard (Task 7).
 * Task 8 wires BUY/AUTO to dropBall + ledger.
 */
export type DropResult = {
  binIndex: number;
  multiplier: number;
};

export type PlinkoBoardHandle = {
  /** Drop one ball; resolves when it lands in a bin. Optional seed biases start X. */
  dropBall: (seed?: string) => Promise<DropResult>;
  /** Animation / physics time scale only — does not change bin math. */
  setSpeed: (speed: number) => void; // 1 | 1.5 | 2 | 3 | 5
};

export type PlinkoGameApi = PlinkoBoardHandle & {
  destroy: () => void;
};
