/** Quick-select presets for balls per BUY (custom input also allowed). */
export const BALL_COUNT_PRESETS = [1, 5, 10, 25] as const;

/** @deprecated Prefer BALL_COUNT_PRESETS; kept as alias for older imports. */
export const BALL_COUNTS = BALL_COUNT_PRESETS;

export const MIN_BALL_COUNT = 1;
/** Max balls in one BUY click. */
export const MAX_BALL_COUNT = 50;

export const DEFAULT_BALL_COUNT = 1;

/**
 * Hard cap of balls on the board at once (multi-click batches).
 * Allows ~2× MAX_BALL_COUNT so consecutive BUY clicks stay playable.
 */
export const MAX_CONCURRENT_BALLS = 100;

/** Clamp a user-entered count to a safe integer in [MIN, MAX]. */
export function clampBallCount(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_BALL_COUNT;
  return Math.min(MAX_BALL_COUNT, Math.max(MIN_BALL_COUNT, Math.floor(n)));
}
