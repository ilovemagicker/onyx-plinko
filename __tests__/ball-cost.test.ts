import { describe, it, expect } from "vitest";
import { BALL_COSTS, DEFAULT_BALL_COST } from "@/lib/ball-cost";

describe("BALL_COSTS", () => {
  it("includes common stake tiers", () => {
    expect(BALL_COSTS).toEqual([1, 5, 10, 25]);
  });

  it("includes DEFAULT_BALL_COST", () => {
    expect(BALL_COSTS).toContain(DEFAULT_BALL_COST);
  });
});

describe("DEFAULT_BALL_COST", () => {
  it("is 10", () => {
    expect(DEFAULT_BALL_COST).toBe(10);
  });
});
