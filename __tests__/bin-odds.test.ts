import { describe, it, expect } from "vitest";
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";
import {
  DEMO_BIN_WEIGHTS,
  DEMO_BIN_ODDS_POWER,
  binomial,
  softenedBinomialWeights,
  normalizeWeights,
  expectedRtp,
  pickBinIndex,
} from "@/lib/bin-odds";

describe("binomial", () => {
  it("matches known values", () => {
    expect(binomial(16, 0)).toBe(1);
    expect(binomial(16, 1)).toBe(16);
    expect(binomial(16, 8)).toBe(12870);
    expect(binomial(16, 16)).toBe(1);
  });
});

describe("DEMO_BIN_WEIGHTS", () => {
  it("has length 17 matching the multiplier table", () => {
    expect(DEMO_BIN_WEIGHTS).toHaveLength(17);
    expect(DEMO_BIN_WEIGHTS).toHaveLength(DEFAULT_MULTIPLIERS.length);
  });

  it("sums to approximately 1", () => {
    const sum = DEMO_BIN_WEIGHTS.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("is symmetric", () => {
    const n = DEMO_BIN_WEIGHTS.length;
    for (let i = 0; i < n; i++) {
      expect(DEMO_BIN_WEIGHTS[i]).toBeCloseTo(DEMO_BIN_WEIGHTS[n - 1 - i]!, 12);
    }
  });

  it("peaks at the center bin", () => {
    const mid = Math.floor(DEMO_BIN_WEIGHTS.length / 2);
    const center = DEMO_BIN_WEIGHTS[mid]!;
    for (let i = 0; i < DEMO_BIN_WEIGHTS.length; i++) {
      if (i === mid) continue;
      expect(center).toBeGreaterThan(DEMO_BIN_WEIGHTS[i]!);
    }
  });

  it("has reachable edges vs raw Galton 1/2^14", () => {
    const edge = DEMO_BIN_WEIGHTS[0]!;
    const rawGaltonEdge = 1 / 2 ** 14; // ~0.000061
    expect(edge).toBeGreaterThan(rawGaltonEdge * 5);
    expect(edge).toBeGreaterThan(0.0004); // ~0.04%+
    expect(edge).toBeLessThan(0.02);
  });

  it("matches softenedBinomialWeights at the published power", () => {
    const rebuilt = softenedBinomialWeights(17, DEMO_BIN_ODDS_POWER);
    for (let i = 0; i < 17; i++) {
      expect(DEMO_BIN_WEIGHTS[i]).toBeCloseTo(rebuilt[i]!, 12);
    }
  });
});

describe("expectedRtp", () => {
  it("lands in the demo house-edge band (~0.94–0.99)", () => {
    const rtp = expectedRtp(DEFAULT_MULTIPLIERS, DEMO_BIN_WEIGHTS);
    expect(rtp).toBeGreaterThanOrEqual(0.94);
    expect(rtp).toBeLessThanOrEqual(0.99);
  });

  it("rejects length mismatch", () => {
    expect(() => expectedRtp([1, 2], [1])).toThrow(/same length/);
  });
});

describe("normalizeWeights", () => {
  it("normalizes positive weights", () => {
    expect(normalizeWeights([1, 1, 2])).toEqual([0.25, 0.25, 0.5]);
  });

  it("rejects empty sum", () => {
    expect(() => normalizeWeights([0, 0])).toThrow();
  });
});

describe("pickBinIndex", () => {
  it("returns 0 for rng just above 0", () => {
    expect(pickBinIndex([0.5, 0.5], () => 0)).toBe(0);
  });

  it("returns last bin when rng is near 1", () => {
    expect(pickBinIndex([0.2, 0.3, 0.5], () => 0.999)).toBe(2);
  });

  it("follows cumulative thresholds", () => {
    const w = [0.1, 0.2, 0.7];
    expect(pickBinIndex(w, () => 0.05)).toBe(0);
    expect(pickBinIndex(w, () => 0.15)).toBe(1);
    expect(pickBinIndex(w, () => 0.5)).toBe(2);
  });

  it("smoke: 20k samples prefer center over edges", () => {
    const counts = new Array(DEMO_BIN_WEIGHTS.length).fill(0);
    let i = 0;
    // Deterministic LCG so the test is stable across runs.
    let state = 123456789;
    const rng = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const N = 20_000;
    for (; i < N; i++) {
      counts[pickBinIndex(DEMO_BIN_WEIGHTS, rng)]++;
    }
    const mid = Math.floor(DEMO_BIN_WEIGHTS.length / 2);
    expect(counts[mid]).toBeGreaterThan(counts[0]);
    expect(counts[mid]).toBeGreaterThan(counts[counts.length - 1]);
    // Edges should appear at least a few times in 20k (reachable).
    expect(counts[0] + counts[counts.length - 1]).toBeGreaterThan(5);
  });
});
