/**
 * Reference-style Plinko payout table: 17 bins, edges high / center low.
 * Matches the Japanese-style board layout (high side payouts).
 * Demo only — not used for real-fund settlement in v1.
 */
export const DEFAULT_MULTIPLIERS: number[] = [
  100, 15, 6, 3, 1.4, 0.7, 0.5, 0.3, 0.5, 0.3, 0.5, 0.7, 1.4, 3, 6, 15, 100,
];

/**
 * Map a normalized landing x in [0, 1] to a bin index.
 * Values outside [0, 1] are clamped to the first/last bin.
 */
export function binIndexForNormalizedX(x: number, binCount: number): number {
  return Math.min(binCount - 1, Math.max(0, Math.floor(x * binCount)));
}
