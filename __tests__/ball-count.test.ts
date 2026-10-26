import { describe, it, expect } from "vitest";
import {
  BALL_COUNT_PRESETS,
  BALL_COUNTS,
  DEFAULT_BALL_COUNT,
  MAX_BALL_COUNT,
  MAX_CONCURRENT_BALLS,
  MIN_BALL_COUNT,
  clampBallCount,
} from "@/lib/ball-count";

describe("BALL_COUNT_PRESETS", () => {
  it("exports quick chips 1 / 5 / 10 / 25", () => {
    expect([...BALL_COUNT_PRESETS]).toEqual([1, 5, 10, 25]);
  });

  it("BALL_COUNTS alias matches presets", () => {
    expect([...BALL_COUNTS]).toEqual([...BALL_COUNT_PRESETS]);
  });

  it("includes DEFAULT_BALL_COUNT", () => {
    expect(BALL_COUNT_PRESETS).toContain(DEFAULT_BALL_COUNT);
  });
});

describe("DEFAULT_BALL_COUNT", () => {
  it("is 1", () => {
    expect(DEFAULT_BALL_COUNT).toBe(1);
  });
});

describe("clampBallCount", () => {
  it("passes through values in range", () => {
    expect(clampBallCount(1)).toBe(1);
    expect(clampBallCount(25)).toBe(25);
    expect(clampBallCount(50)).toBe(50);
  });

  it("floors fractions and clamps out-of-range", () => {
    expect(clampBallCount(3.9)).toBe(3);
    expect(clampBallCount(0)).toBe(MIN_BALL_COUNT);
    expect(clampBallCount(-5)).toBe(MIN_BALL_COUNT);
    expect(clampBallCount(999)).toBe(MAX_BALL_COUNT);
  });

  it("falls back on non-finite", () => {
    expect(clampBallCount(Number.NaN)).toBe(DEFAULT_BALL_COUNT);
    expect(clampBallCount(Number.POSITIVE_INFINITY)).toBe(DEFAULT_BALL_COUNT);
  });
});

describe("MAX_CONCURRENT_BALLS", () => {
  it("is at least MAX_BALL_COUNT", () => {
    expect(MAX_CONCURRENT_BALLS).toBeGreaterThanOrEqual(MAX_BALL_COUNT);
  });
});
