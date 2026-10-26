import { describe, it, expect } from "vitest";
import {
  STUCK_SPEED_EPSILON,
  STUCK_MIN_MS,
  ballSpeed,
  isStuckAboveBins,
  antiStuckVelocity,
  steeredVx,
} from "@/lib/anti-stuck";

describe("ballSpeed", () => {
  it("returns hypot of vx/vy", () => {
    expect(ballSpeed(3, 4)).toBe(5);
    expect(ballSpeed(0, 0)).toBe(0);
  });
});

describe("isStuckAboveBins", () => {
  const binTop = 420;

  it("is false while still moving", () => {
    expect(
      isStuckAboveBins({
        speed: STUCK_SPEED_EPSILON + 0.5,
        y: 80,
        binTop,
        stuckMs: 1000,
      }),
    ).toBe(false);
  });

  it("is false before min stuck duration", () => {
    expect(
      isStuckAboveBins({
        speed: 0.05,
        y: 80,
        binTop,
        stuckMs: STUCK_MIN_MS - 1,
      }),
    ).toBe(false);
  });

  it("is false near / below the bin shelf (landing is fine)", () => {
    expect(
      isStuckAboveBins({
        speed: 0.05,
        y: binTop - 10,
        binTop,
        stuckMs: 1000,
      }),
    ).toBe(false);
  });

  it("is true when near-zero speed for long enough above the shelf", () => {
    expect(
      isStuckAboveBins({
        speed: 0.05,
        y: 80,
        binTop,
        stuckMs: STUCK_MIN_MS,
      }),
    ).toBe(true);
  });
});

describe("antiStuckVelocity", () => {
  it("returns non-zero horizontal and downward vertical impulse", () => {
    const seq = [0.1, 0.5, 0.5]; // side left, |vx| mid, vy mid
    let i = 0;
    const v = antiStuckVelocity(() => seq[i++] ?? 0.5);
    expect(Math.abs(v.vx)).toBeGreaterThan(1);
    expect(v.vy).toBeGreaterThan(1);
  });

  it("picks left or right from rand", () => {
    const left = antiStuckVelocity(() => 0.1);
    const right = antiStuckVelocity(() => 0.9);
    expect(Math.sign(left.vx)).not.toBe(Math.sign(right.vx));
  });
});

describe("steeredVx", () => {
  it("does not damp micro-drift when nearly stopped (root cause of peg rest)", () => {
    // A tiny tip-off vx must survive; old code used * 0.88 every frame.
    const next = steeredVx({ vx: 0.12, steer: 0, speed: 0.12 });
    expect(next).toBeCloseTo(0.12, 5);
  });

  it("keeps mild damping while moving so steer still reads as soft", () => {
    const next = steeredVx({ vx: 2, steer: 0.5, speed: 2.5 });
    expect(next).toBeCloseTo(2 * 0.88 + 0.5, 5);
  });
});
