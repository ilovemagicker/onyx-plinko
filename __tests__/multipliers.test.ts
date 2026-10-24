import { describe, it, expect } from "vitest";
import {
  DEFAULT_MULTIPLIERS,
  binIndexForNormalizedX,
} from "@/lib/multipliers";

describe("DEFAULT_MULTIPLIERS", () => {
  it("has odd length >= 9", () => {
    expect(DEFAULT_MULTIPLIERS.length).toBeGreaterThanOrEqual(9);
    expect(DEFAULT_MULTIPLIERS.length % 2).toBe(1);
  });

  it("matches the 17-bin edges-modest polished table", () => {
    expect(DEFAULT_MULTIPLIERS).toEqual([
      25, 10, 5, 3, 1.5, 1, 0.7, 0.5, 0.8, 0.5, 0.7, 1, 1.5, 3, 5, 10, 25,
    ]);
  });

  it("has high multipliers at both edges", () => {
    const mid = Math.floor(DEFAULT_MULTIPLIERS.length / 2);
    expect(DEFAULT_MULTIPLIERS[0]).toBeGreaterThan(DEFAULT_MULTIPLIERS[mid]!);
    expect(DEFAULT_MULTIPLIERS[DEFAULT_MULTIPLIERS.length - 1]).toBeGreaterThan(
      DEFAULT_MULTIPLIERS[mid]!,
    );
  });

  it("keeps edge prizes at or below 40x", () => {
    expect(DEFAULT_MULTIPLIERS[0]).toBeLessThanOrEqual(40);
    expect(DEFAULT_MULTIPLIERS[DEFAULT_MULTIPLIERS.length - 1]).toBeLessThanOrEqual(
      40,
    );
  });
});

describe("binIndexForNormalizedX", () => {
  const binCount = 17;

  it("maps 0 to first bin", () => {
    expect(binIndexForNormalizedX(0, binCount)).toBe(0);
  });

  it("maps just below 1 to last bin", () => {
    expect(binIndexForNormalizedX(0.999, binCount)).toBe(binCount - 1);
  });

  it("clamps x > 1 to last bin", () => {
    expect(binIndexForNormalizedX(1, binCount)).toBe(binCount - 1);
    expect(binIndexForNormalizedX(1.5, binCount)).toBe(binCount - 1);
  });

  it("clamps x < 0 to first bin", () => {
    expect(binIndexForNormalizedX(-0.1, binCount)).toBe(0);
  });

  it("uses floor(x * binCount) within range", () => {
    expect(binIndexForNormalizedX(0.5, binCount)).toBe(
      Math.floor(0.5 * binCount),
    );
  });
});
