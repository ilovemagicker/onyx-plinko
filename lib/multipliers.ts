/**
 * Reference-style Plinko payout table: 17 bins, edges high / center low.
 * Edge prizes kept modest (25x) so jackpots stay rare without blowing RTP.
 * Demo only — not used for real-fund settlement in v1.
 */
export const DEFAULT_MULTIPLIERS: number[] = [
  25, 10, 5, 3, 1.5, 1, 0.7, 0.5, 0.8, 0.5, 0.7, 1, 1.5, 3, 5, 10, 25,
];

/**
 * Map a normalized landing x in [0, 1] to a bin index.
 * Values outside [0, 1] are clamped to the first/last bin.
 */
export function binIndexForNormalizedX(x: number, binCount: number): number {
  return Math.min(binCount - 1, Math.max(0, Math.floor(x * binCount)));
}
