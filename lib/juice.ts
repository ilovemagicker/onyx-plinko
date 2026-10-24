/**
 * Celebration + combo helpers for Plinko landings (demo UI juice).
 */

export type JuiceTier = "none" | "nice" | "big" | "jackpot";

/** Tier thresholds: ≥3 nice, ≥15 big, ≥100 jackpot. */
export function juiceTierForMultiplier(mult: number): JuiceTier {
  if (mult >= 100) return "jackpot";
  if (mult >= 15) return "big";
  if (mult >= 3) return "nice";
  return "none";
}

export function juiceLabel(tier: JuiceTier): string | null {
  switch (tier) {
    case "jackpot":
      return "JACKPOT";
    case "big":
      return "BIG WIN";
    case "nice":
      return "NICE";
    default:
      return null;
  }
}

/**
 * Combo / streak: consecutive lands at ≥1x count; break on <1x.
 * Returns the next streak value.
 */
export function nextStreak(prev: number, multiplier: number): number {
  if (multiplier >= 1) return prev + 1;
  return 0;
}

/** Milestone flags for optional extra juice (3 / 5 / 10). */
export function isStreakMilestone(streak: number): boolean {
  return streak === 3 || streak === 5 || streak === 10;
}
