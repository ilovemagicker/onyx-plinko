/**
 * Classic Galton / triangle Plinko peg counts.
 * Row r has startPegs + r pegs, centered; last row has binCount - 1 pegs
 * so balls fall into binCount gaps (bins) between/around them.
 */
export function trianglePegCounts(
  binCount: number,
  startPegs = 3,
): number[] {
  if (binCount < 3) {
    throw new Error("binCount must be >= 3");
  }
  const lastPegs = binCount - 1;
  if (startPegs < 2 || startPegs > lastPegs) {
    throw new Error("startPegs must be in [2, binCount - 1]");
  }
  const rows: number[] = [];
  for (let n = startPegs; n <= lastPegs; n++) {
    rows.push(n);
  }
  return rows;
}

export type PegPoint = { x: number; y: number; row: number; col: number };

export type GuideEndpoints = {
  left: [{ x: number; y: number }, { x: number; y: number }];
  right: [{ x: number; y: number }, { x: number; y: number }];
  spacing: number;
};

/**
 * Centered triangle peg positions for a board of given size.
 * Horizontal spacing is derived from the bottom row spanning usable width.
 */
export function trianglePegPositions(opts: {
  binCount: number;
  width: number;
  topY: number;
  bottomY: number;
  marginX?: number;
  startPegs?: number;
}): PegPoint[] {
  const startPegs = opts.startPegs ?? 3;
  const marginX = opts.marginX ?? 28;
  const counts = trianglePegCounts(opts.binCount, startPegs);
  const lastPegs = counts[counts.length - 1]!;
  const usable = Math.max(1, opts.width - 2 * marginX);
  const spacing = lastPegs > 1 ? usable / (lastPegs - 1) : usable;
  const rowGap =
    counts.length > 1
      ? (opts.bottomY - opts.topY) / (counts.length - 1)
      : 0;

  const points: PegPoint[] = [];
  for (let row = 0; row < counts.length; row++) {
    const pegsInRow = counts[row]!;
    const y = opts.topY + row * rowGap;
    const rowWidth = (pegsInRow - 1) * spacing;
    const startX = opts.width / 2 - rowWidth / 2;
    for (let col = 0; col < pegsInRow; col++) {
      points.push({ x: startX + col * spacing, y, row, col });
    }
  }
  return points;
}

/**
 * Outer slant endpoints for left/right triangle guides.
 * `pad` is outward from outer pegs; use a small pad (or slightly negative)
 * so gutters shrink and the ball stays visually inside the pyramid.
 */
export function triangleGuideEndpoints(opts: {
  binCount: number;
  width: number;
  topY: number;
  bottomY: number;
  marginX?: number;
  startPegs?: number;
  pad?: number;
  /** Extra overhang above topY / below bottomY for the physical rails. */
  extendTop?: number;
  extendBottom?: number;
}): GuideEndpoints {
  const startPegs = opts.startPegs ?? 3;
  const marginX = opts.marginX ?? 28;
  const pad = opts.pad ?? 4;
  const extendTop = opts.extendTop ?? 18;
  const extendBottom = opts.extendBottom ?? 20;
  const counts = trianglePegCounts(opts.binCount, startPegs);
  const first = counts[0]!;
  const last = counts[counts.length - 1]!;
  const usable = Math.max(1, opts.width - 2 * marginX);
  const spacing = last > 1 ? usable / (last - 1) : usable;

  const topWidth = (first - 1) * spacing;
  const botWidth = (last - 1) * spacing;
  const topLeft = opts.width / 2 - topWidth / 2 - pad;
  const topRight = opts.width / 2 + topWidth / 2 + pad;
  const botLeft = opts.width / 2 - botWidth / 2 - pad;
  const botRight = opts.width / 2 + botWidth / 2 + pad;

  // Extend past peg rows along the same slope so spawn & bin approach stay enclosed.
  const topY = opts.topY - extendTop;
  const botY = opts.bottomY + extendBottom;
  const pegSpanY = Math.max(1, opts.bottomY - opts.topY);
  const topT = (topY - opts.topY) / pegSpanY; // negative when extending up
  const botT = (botY - opts.topY) / pegSpanY;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    left: [
      { x: lerp(topLeft, botLeft, topT), y: topY },
      { x: lerp(topLeft, botLeft, botT), y: botY },
    ],
    right: [
      { x: lerp(topRight, botRight, topT), y: topY },
      { x: lerp(topRight, botRight, botT), y: botY },
    ],
    spacing,
  };
}

/** Horizontal envelope between left/right guide segments at a given y. */
export function guideEnvelopeXAtY(
  guides: Pick<GuideEndpoints, "left" | "right">,
  y: number,
): { leftX: number; rightX: number } {
  const along = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    yy: number,
  ) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) < 1e-6) return a.x;
    const t = (yy - a.y) / dy;
    return a.x + (b.x - a.x) * t;
  };
  return {
    leftX: along(guides.left[0], guides.left[1], y),
    rightX: along(guides.right[0], guides.right[1], y),
  };
}
