/**
 * Keep Plinko balls inside the triangle side rails.
 *
 * Balls can tunnel through thin Matter slant guides (high speedScale /
 * multi-ball / anti-stuck impulse) and then roll down the gutter between
 * the candy chevron rails and the outer board walls — "outside the line".
 */

export type GuideEnv = { leftX: number; rightX: number };

/** Soft-clamp preferred inset ≈ ball radius so the coin stays visually inside. */
export const RAIL_CLAMP_PREFERRED = 7;
/** Keep a usable corridor at the pyramid throat. */
export const RAIL_CLAMP_MIN_USABLE = 10;
/** Hard inward kick when soft-clamp teleports back inside. */
export const RAIL_BOUNCE_VX = 1.35;

/**
 * Clamp ball-center x into [left+inset, right-inset].
 * Returns null when already inside (no teleport).
 */
export function clampInsideRailEnvelope(opts: {
  x: number;
  env: GuideEnv;
  inset: number;
}): { x: number; side: "left" | "right" } | null {
  const minX = opts.env.leftX + opts.inset;
  const maxX = opts.env.rightX - opts.inset;
  if (opts.x < minX) return { x: minX, side: "left" };
  if (opts.x > maxX) return { x: maxX, side: "right" };
  return null;
}

/** Velocity after a rail soft-clamp bounce (always push inward). */
export function railBounceVx(side: "left" | "right", vx: number): number {
  if (side === "left") return Math.abs(vx) * 0.2 + RAIL_BOUNCE_VX;
  return -Math.abs(vx) * 0.2 - RAIL_BOUNCE_VX;
}

/**
 * Soft inward pull near the rails so gutters never look empty.
 * Does not teleport — only nudges vx.
 */
export function railEdgePullVx(opts: {
  x: number;
  env: GuideEnv;
  inset: number;
  vx: number;
  edgeZone: number;
  pull?: number;
}): number {
  const pull = opts.pull ?? 0.4;
  const minX = opts.env.leftX + opts.inset;
  const maxX = opts.env.rightX - opts.inset;
  let vx = opts.vx;
  if (opts.x - minX < opts.edgeZone) vx += pull;
  else if (maxX - opts.x < opts.edgeZone) vx -= pull;
  return vx;
}

/**
 * Outward offsets (px) for backup Matter rails that seal the gutter
 * between the primary slant guide and the board edge.
 */
export const RAIL_OUTER_OFFSETS = [0, 8, 18, 30, 44] as const;

/** Primary / backup rail thicknesses along the outward stack. */
export const RAIL_THICKNESS_PRIMARY = 18;
export const RAIL_THICKNESS_BACKUP = 14;
