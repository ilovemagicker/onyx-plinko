/**
 * Anti-stuck helpers for Plinko balls that balance on peg apices.
 *
 * Root cause: the per-frame steer loop used to damp horizontal velocity
 * (`vx * 0.88`) even when nearly stopped, killing the micro lateral drift
 * that would tip a ball off a peg. These helpers detect that state and
 * produce a small random nudge, and skip damping while nearly stopped.
 */

export const STUCK_SPEED_EPSILON = 0.18;
export const STUCK_MIN_MS = 220;
export const STUCK_SHELF_MARGIN = 24;

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

/** Small random horizontal + downward impulse to tip off a peg apex. */
export function antiStuckVelocity(
  rand: () => number = Math.random,
): { vx: number; vy: number } {
  const side = rand() < 0.5 ? -1 : 1;
  const vx = side * (1.6 + rand() * 1.8);
  const vy = 1.8 + rand() * 1.2;
  return { vx, vy };
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
