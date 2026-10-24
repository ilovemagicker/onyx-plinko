import { describe, it, expect } from "vitest";
import {
  triangleGuideEndpoints,
  trianglePegCounts,
  trianglePegPositions,
} from "@/lib/peg-layout";
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";

describe("trianglePegCounts", () => {
  it("grows by 1 each row and ends at binCount-1", () => {
    const counts = trianglePegCounts(17, 3);
    expect(counts[0]).toBe(3);
    expect(counts[counts.length - 1]).toBe(16);
    expect(counts).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it("matches 17-bin board (14 rows, classic Galton)", () => {
    expect(DEFAULT_MULTIPLIERS.length).toBe(17);
    const counts = trianglePegCounts(DEFAULT_MULTIPLIERS.length, 3);
    expect(counts.length).toBe(14);
    expect(counts[counts.length - 1]).toBe(DEFAULT_MULTIPLIERS.length - 1);
  });

  it("rejects invalid startPegs", () => {
    expect(() => trianglePegCounts(17, 1)).toThrow();
    expect(() => trianglePegCounts(17, 17)).toThrow();
  });
});

describe("trianglePegPositions", () => {
  it("centers every row on the board midline", () => {
    const width = 360;
    const points = trianglePegPositions({
      binCount: 17,
      width,
      topY: 50,
      bottomY: 380,
      startPegs: 3,
    });
    const byRow = new Map<number, typeof points>();
    for (const p of points) {
      const list = byRow.get(p.row) ?? [];
      list.push(p);
      byRow.set(p.row, list);
    }
    for (const [, rowPts] of byRow) {
      const xs = rowPts.map((p) => p.x).sort((a, b) => a - b);
      const mid = (xs[0]! + xs[xs.length - 1]!) / 2;
      expect(mid).toBeCloseTo(width / 2, 5);
    }
  });

  it("top row is narrower than bottom row", () => {
    const points = trianglePegPositions({
      binCount: 17,
      width: 360,
      topY: 50,
      bottomY: 380,
      startPegs: 3,
    });
    const top = points.filter((p) => p.row === 0);
    const bottom = points.filter((p) => p.row === 13);
    const topSpan = Math.max(...top.map((p) => p.x)) - Math.min(...top.map((p) => p.x));
    const botSpan =
      Math.max(...bottom.map((p) => p.x)) - Math.min(...bottom.map((p) => p.x));
    expect(topSpan).toBeLessThan(botSpan * 0.35);
  });
});

describe("triangleGuideEndpoints", () => {
  it("slants outward from top to bottom", () => {
    const g = triangleGuideEndpoints({
      binCount: 17,
      width: 360,
      topY: 50,
      bottomY: 380,
      startPegs: 3,
    });
    expect(g.left[0].x).toBeGreaterThan(g.left[1].x);
    expect(g.right[0].x).toBeLessThan(g.right[1].x);
  });
});
