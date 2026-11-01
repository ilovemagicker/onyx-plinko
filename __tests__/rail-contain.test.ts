import { describe, it, expect } from "vitest";
import {
  RAIL_BOUNCE_VX,
  RAIL_CLAMP_PREFERRED,
  RAIL_OUTER_OFFSETS,
  clampInsideRailEnvelope,
  railBounceVx,
  railEdgePullVx,
} from "@/lib/rail-contain";

describe("clampInsideRailEnvelope", () => {
  const env = { leftX: 100, rightX: 260 };

  it("returns null when already inside", () => {
    expect(
      clampInsideRailEnvelope({ x: 180, env, inset: RAIL_CLAMP_PREFERRED }),
    ).toBeNull();
  });

  it("teleports back from left gutter (outside the line)", () => {
    const hit = clampInsideRailEnvelope({
      x: 80,
      env,
      inset: RAIL_CLAMP_PREFERRED,
    });
    expect(hit).toEqual({ x: 100 + RAIL_CLAMP_PREFERRED, side: "left" });
  });

  it("teleports back from right gutter", () => {
    const hit = clampInsideRailEnvelope({
      x: 280,
      env,
      inset: RAIL_CLAMP_PREFERRED,
    });
    expect(hit).toEqual({ x: 260 - RAIL_CLAMP_PREFERRED, side: "right" });
  });
});

describe("railBounceVx", () => {
  it("always pushes inward hard enough to clear the rail", () => {
    expect(railBounceVx("left", -4)).toBeGreaterThanOrEqual(RAIL_BOUNCE_VX);
    expect(railBounceVx("right", 4)).toBeLessThanOrEqual(-RAIL_BOUNCE_VX);
  });
});

describe("railEdgePullVx", () => {
  it("nudges away from the left rail edge", () => {
    const env = { leftX: 100, rightX: 260 };
    const next = railEdgePullVx({
      x: 108,
      env,
      inset: 7,
      vx: 0,
      edgeZone: 12,
      pull: 0.4,
    });
    expect(next).toBeGreaterThan(0);
  });
});

describe("RAIL_OUTER_OFFSETS", () => {
  it("stacks far enough to seal the board-edge gutter", () => {
    expect(RAIL_OUTER_OFFSETS[0]).toBe(0);
    expect(RAIL_OUTER_OFFSETS[RAIL_OUTER_OFFSETS.length - 1]!).toBeGreaterThanOrEqual(40);
    expect(RAIL_OUTER_OFFSETS.length).toBeGreaterThanOrEqual(4);
  });
});
