/**
 * Risk modes for demo Plinko: Low / Medium / High.
 * Each mode has its own 17-bin multiplier table + softened Galton weights
 * tuned so RTP stays in ~0.94–0.99 with rare edges.
 */

import { softenedBinomialWeights, expectedRtp } from "@/lib/bin-odds";

export type RiskMode = "low" | "medium" | "high";

export const RISK_MODE_IDS: RiskMode[] = ["low", "medium", "high"];

export const RISK_LABELS: Record<RiskMode, { zh: string; en: string }> = {
  low: { zh: "低", en: "Low" },
  medium: { zh: "中", en: "Med" },
  high: { zh: "高", en: "High" },
};

/**
 * Softening power per risk (weight ∝ C(n,k)^power).
 * Higher power → rarer edges.
 */
export const RISK_ODDS_POWER: Record<RiskMode, number> = {
  low: 0.7,
  medium: 0.6,
  high: 0.7,
};

/** 17-bin symmetric tables. High edges = 100x (juiciest). */
export const RISK_MULTIPLIERS: Record<RiskMode, number[]> = {
  // Safest: edges 5x, center near 1x
  low: [5, 3, 2, 1.5, 1.2, 1, 0.9, 0.8, 0.9, 0.8, 0.9, 1, 1.2, 1.5, 2, 3, 5],
  // Milder edges
  medium: [10, 5, 3, 2, 1.5, 1, 0.8, 0.6, 0.8, 0.6, 0.8, 1, 1.5, 2, 3, 5, 10],
  // Classic spicy table — 100x edges
  high: [100, 20, 8, 4, 2, 1, 0.5, 0.3, 0.5, 0.3, 0.5, 1, 2, 4, 8, 20, 100],
};

export const RISK_BIN_WEIGHTS: Record<RiskMode, number[]> = {
  low: softenedBinomialWeights(RISK_MULTIPLIERS.low.length, RISK_ODDS_POWER.low),
  medium: softenedBinomialWeights(
    RISK_MULTIPLIERS.medium.length,
    RISK_ODDS_POWER.medium,
  ),
  high: softenedBinomialWeights(
    RISK_MULTIPLIERS.high.length,
    RISK_ODDS_POWER.high,
  ),
};

export const DEFAULT_RISK: RiskMode = "high";

export const RISK_STORAGE_KEY = "onyx-plinko-risk";

export function isRiskMode(value: unknown): value is RiskMode {
  return value === "low" || value === "medium" || value === "high";
}

export function getRiskMultipliers(risk: RiskMode): number[] {
  return RISK_MULTIPLIERS[risk];
}

export function getRiskWeights(risk: RiskMode): number[] {
  return RISK_BIN_WEIGHTS[risk];
}

export function getRiskRtp(risk: RiskMode): number {
  return expectedRtp(RISK_MULTIPLIERS[risk], RISK_BIN_WEIGHTS[risk]);
}

export function loadStoredRisk(fallback: RiskMode = DEFAULT_RISK): RiskMode {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(RISK_STORAGE_KEY);
    if (isRiskMode(raw)) return raw;
  } catch {
    // ignore
  }
  return fallback;
}

export function saveStoredRisk(risk: RiskMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RISK_STORAGE_KEY, risk);
  } catch {
    // ignore
  }
}
