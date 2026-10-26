import { describe, it, expect } from "vitest";
import {
  STUCK_SPEED_EPSILON,
  STUCK_MIN_MS,
  STAGNANT_FRAMES,
  ballSpeed,
  isStuckAboveBins,
  isYStagnant,
  antiStuckVelocity,
  spawnDropVelocity,
  steeredVx,
  guideClampInset,
  velocityWithSteeredX,
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

  it("uses a short min duration so peg rests unstick quickly", () => {
    expect(STUCK_MIN_MS).toBeLessThanOrEqual(120);
  });
});

describe("isYStagnant", () => {
  const binTop = 420;

  it("is false until enough frames accumulate", () => {
    expect(
      isYStagnant({
        y: 80.2,
        yAtWindowStart: 80,
        framesInWindow: STAGNANT_FRAMES - 1,
        binTop,
      }),
    ).toBe(false);
  });

  it("is true when y barely advances over the window above the shelf", () => {
    expect(
      isYStagnant({
        y: 80.3,
        yAtWindowStart: 80,
        framesInWindow: STAGNANT_FRAMES,
        binTop,
      }),
    ).toBe(true);
  });

  it("is false when falling normally", () => {
    expect(
      isYStagnant({
        y: 95,
        yAtWindowStart: 80,
        framesInWindow: STAGNANT_FRAMES,
        binTop,
      }),
    ).toBe(false);
  });
});

describe("antiStuckVelocity", () => {
  it("returns non-zero horizontal and downward vertical impulse", () => {
    const seq = [0.1, 0.5, 0.5]; // side left, |vx| mid, vy mid
    let i = 0;
    const v = antiStuckVelocity(() => seq[i++] ?? 0.5);
    expect(Math.abs(v.vx)).toBeGreaterThan(2);
    expect(v.vy).toBeGreaterThan(2.5);
  });

  it("picks left or right from rand", () => {
    const left = antiStuckVelocity(() => 0.1);
    const right = antiStuckVelocity(() => 0.9);
    expect(Math.sign(left.vx)).not.toBe(Math.sign(right.vx));
  });
});

describe("spawnDropVelocity", () => {
  it("always has clear downward velocity", () => {
    for (let i = 0; i < 20; i++) {
      const v = spawnDropVelocity(() => i / 20);
      expect(v.vy).toBeGreaterThanOrEqual(2.8);
    }
  });

  it("spreads horizontal slightly", () => {
    const a = spawnDropVelocity(() => 0);
    const b = spawnDropVelocity(() => 0.999);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });
});

describe("guideClampInset", () => {
  it("never exceeds half-gap so the corridor cannot invert", () => {
    // Throat gap ~24px with preferred inset 8.5 would leave ~7 usable —
    // but a 9.5 preferred on a 20px gap must shrink.
    expect(guideClampInset({ gap: 20, preferred: 9.5, minUsable: 4 })).toBe(8);
    expect(guideClampInset({ gap: 10, preferred: 9.5, minUsable: 4 })).toBe(3);
  });

  it("keeps preferred inset when the gap is wide enough", () => {
    expect(guideClampInset({ gap: 44, preferred: 8.5, minUsable: 4 })).toBe(8.5);
  });

  it("returns 0 when gap is tiny", () => {
    expect(guideClampInset({ gap: 2, preferred: 8.5, minUsable: 4 })).toBe(0);
  });
});

describe("velocityWithSteeredX", () => {
  it("preserves engine vy so gravity is not cancelled", () => {
    expect(velocityWithSteeredX({ newVx: 1.5, engineVy: 2.3 })).toEqual({
      x: 1.5,
      y: 2.3,
    });
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
