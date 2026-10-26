/**
 * Anti-stuck helpers for Plinko balls that balance on peg apices.
 *
 * Root causes (2026-10-26 follow-up):
 * 1. Soft guide clamp used a fixed inset (radius+2) that at the pyramid
 *    throat left a usable corridor narrower than the outer pegs — balls
 *    were funneled onto the center apex peg.
 * 2. Per-frame Body.setVelocity({ x, y: readVy }) re-asserted near-zero
 *    vy while resting on a peg, fighting Matter gravity rebuild.
 * 3. Spawn had no initial downward velocity, so balls could settle at the
 *    mouth / first peg row.
 * 4. First anti-stuck (220ms + mild nudge) was too slow / weak once balls
 *    stacked on the apex.
 */

export const STUCK_SPEED_EPSILON = 0.18;
/** Fire unstick sooner — peg rests lock within ~2–3 frames. */
export const STUCK_MIN_MS = 100;
export const STUCK_SHELF_MARGIN = 24;
/** If y advances less than this over STAGNANT_FRAMES while above shelf → stuck. */
export const STAGNANT_Y_EPSILON = 0.6;
export const STAGNANT_FRAMES = 8;

export function ballSpeed(vx: number, vy: number): number {
  return Math.hypot(vx, vy);
}

export function isStuckAboveBins(opts: {
  speed: number;
  y: number;
  binTop: number;
  stuckMs: number;
  speedEpsilon?: number;
  minStuckMs?: number;
  shelfMargin?: number;
}): boolean {
  const eps = opts.speedEpsilon ?? STUCK_SPEED_EPSILON;
  const minMs = opts.minStuckMs ?? STUCK_MIN_MS;
  const margin = opts.shelfMargin ?? STUCK_SHELF_MARGIN;
  return (
    opts.speed < eps &&
    opts.y < opts.binTop - margin &&
    opts.stuckMs >= minMs
  );
}

/**
 * True when the ball's y barely advances for N frames while still above
 * the bin shelf (balanced on a peg even if speed flickers above epsilon).
 */
export function isYStagnant(opts: {
  y: number;
  yAtWindowStart: number;
  framesInWindow: number;
  binTop: number;
  yEpsilon?: number;
  minFrames?: number;
  shelfMargin?: number;
}): boolean {
  const yEps = opts.yEpsilon ?? STAGNANT_Y_EPSILON;
  const minFrames = opts.minFrames ?? STAGNANT_FRAMES;
  const margin = opts.shelfMargin ?? STUCK_SHELF_MARGIN;
  if (opts.y >= opts.binTop - margin) return false;
  if (opts.framesInWindow < minFrames) return false;
  return opts.y - opts.yAtWindowStart < yEps;
}

/** Stronger random horizontal + downward impulse to tip off a peg apex. */
export function antiStuckVelocity(
  rand: () => number = Math.random,
): { vx: number; vy: number } {
  const side = rand() < 0.5 ? -1 : 1;
  const vx = side * (2.8 + rand() * 2.4);
  const vy = 3.2 + rand() * 2.0;
  return { vx, vy };
}

/** Initial drop impulse so the ball cannot rest at the mouth / first peg. */
export function spawnDropVelocity(
  rand: () => number = Math.random,
): { vx: number; vy: number } {
  const vx = (rand() - 0.5) * 2.8;
  const vy = 2.8 + rand() * 1.6;
  return { vx, vy };
}

/**
 * Soft clamp inset that never inverts the envelope.
 * Fixed radius+N insets at the pyramid throat left a corridor narrower
 * than the outer pegs and funneled every ball onto the center apex.
 */
export function guideClampInset(opts: {
  gap: number;
  preferred: number;
  /** Keep at least this much usable width when possible. */
  minUsable?: number;
}): number {
  const minUsable = opts.minUsable ?? 4;
  const maxInset = Math.max(0, (opts.gap - minUsable) / 2);
  return Math.min(opts.preferred, maxInset);
}

/**
 * Apply steer with damping only while the ball is moving.
 * Near-zero speed → no horizontal damp (preserves tip-off drift).
 */
export function steeredVx(opts: {
  vx: number;
  steer: number;
  speed: number;
}): number {
  const damp = opts.speed < STUCK_SPEED_EPSILON ? 1 : 0.88;
  return opts.vx * damp + opts.steer;
}

/**
 * Build the velocity write for steer: change x only, keep the engine's
 * current y so we never re-assert a post-collision vy≈0 and cancel gravity.
 */
export function velocityWithSteeredX(opts: {
  newVx: number;
  engineVy: number;
}): { x: number; y: number } {
  return { x: opts.newVx, y: opts.engineVy };
}
