import { describe, it, expect } from "vitest";
import {
  isStreakMilestone,
  juiceLabel,
  juiceTierForMultiplier,
  nextStreak,
} from "@/lib/juice";

describe("juiceTierForMultiplier", () => {
  it("maps thresholds", () => {
    expect(juiceTierForMultiplier(0.5)).toBe("none");
    expect(juiceTierForMultiplier(2.9)).toBe("none");
    expect(juiceTierForMultiplier(3)).toBe("nice");
    expect(juiceTierForMultiplier(14.9)).toBe("nice");
    expect(juiceTierForMultiplier(15)).toBe("big");
    expect(juiceTierForMultiplier(99)).toBe("big");
    expect(juiceTierForMultiplier(100)).toBe("jackpot");
  });
});

describe("juiceLabel", () => {
  it("returns celebration copy", () => {
    expect(juiceLabel("none")).toBeNull();
    expect(juiceLabel("nice")).toBe("NICE");
    expect(juiceLabel("big")).toBe("BIG WIN");
    expect(juiceLabel("jackpot")).toBe("JACKPOT");
  });
});

describe("nextStreak", () => {
  it("increments on ≥1x and breaks on <1x", () => {
    expect(nextStreak(0, 1)).toBe(1);
    expect(nextStreak(3, 1.5)).toBe(4);
    expect(nextStreak(5, 0.9)).toBe(0);
    expect(nextStreak(2, 0.3)).toBe(0);
  });
});

describe("isStreakMilestone", () => {
  it("flags 3 / 5 / 10", () => {
    expect(isStreakMilestone(3)).toBe(true);
    expect(isStreakMilestone(5)).toBe(true);
    expect(isStreakMilestone(10)).toBe(true);
    expect(isStreakMilestone(4)).toBe(false);
    expect(isStreakMilestone(1)).toBe(false);
  });
});
