/**
 * Default Plinko payout table = High risk (17 bins, 100x edges).
 * Per-mode tables live in lib/risk-modes.ts.
 * Demo only — not used for real-fund settlement in v1.
 */
export const DEFAULT_MULTIPLIERS: number[] = [
  100, 20, 8, 4, 2, 1, 0.5, 0.3, 0.5, 0.3, 0.5, 1, 2, 4, 8, 20, 100,
];

/**
 * Map a normalized landing x in [0, 1] to a bin index.
 * Values outside [0, 1] are clamped to the first/last bin.
 */
export function binIndexForNormalizedX(x: number, binCount: number): number {
  return Math.min(binCount - 1, Math.max(0, Math.floor(x * binCount)));
}
