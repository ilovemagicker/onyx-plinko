/**
 * Published demo landing weights for the 17-bin Plinko table.
 *
 * Physics is visual only; settlement uses a pre-chosen bin drawn from these
 * weights so jackpot edges stay reachable and RTP stays a mild house edge.
 *
 * Shape: softened Galton — weight ∝ C(n,k)^power with power < 1 (not raw 1/2^n).
 * DEMO_* mirrors High risk (see lib/risk-modes.ts).
 */

/** Binomial coefficient C(n, k). */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < kk; i++) {
    r = (r * (n - i)) / (i + 1);
  }
  return r;
}

/** Soften a Galton row: weights ∝ C(binCount-1, k)^power, then normalize. */
export function softenedBinomialWeights(
  binCount: number,
  power: number,
): number[] {
  if (binCount < 2) {
    throw new Error("binCount must be >= 2");
  }
  if (!(power > 0)) {
    throw new Error("power must be > 0");
  }
  const n = binCount - 1;
  const raw = Array.from({ length: binCount }, (_, k) =>
    Math.pow(binomial(n, k), power),
  );
  return normalizeWeights(raw);
}

export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) {
    throw new Error("weights must sum to a positive number");
  }
  return weights.map((w) => w / sum);
}

/**
 * Softening power for the published High-risk demo table.
 * power=1 → classic Galton; lower → fatter tails / more reachable edges.
 */
export const DEMO_BIN_ODDS_POWER = 0.7;

/** Length-17 published probabilities (High risk), sum ≈ 1. */
export const DEMO_BIN_WEIGHTS: number[] = softenedBinomialWeights(
  17,
  DEMO_BIN_ODDS_POWER,
);

/** Expected return = Σ p_i * m_i (1 = fair; <1 house edge). */
export function expectedRtp(
  multipliers: number[],
  weights: number[],
): number {
  if (multipliers.length !== weights.length) {
    throw new Error("multipliers and weights must have the same length");
  }
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += (weights[i] ?? 0) * (multipliers[i] ?? 0);
  }
  return sum;
}

/**
 * Draw a bin index from cumulative weights.
 * `rng` returns a uniform float in [0, 1). Defaults to Math.random.
 */
export function pickBinIndex(
  weights: number[],
  rng: () => number = Math.random,
): number {
  if (weights.length === 0) {
    throw new Error("weights must be non-empty");
  }
  const u = Math.min(0.999999999999, Math.max(0, rng()));
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i] ?? 0;
    if (u < cumulative) return i;
  }
  return weights.length - 1;
}
