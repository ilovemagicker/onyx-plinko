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

/** Outer slant endpoints for left/right triangle guides (slightly outside pegs). */
export function triangleGuideEndpoints(opts: {
  binCount: number;
  width: number;
  topY: number;
  bottomY: number;
  marginX?: number;
  startPegs?: number;
  pad?: number;
}): {
  left: [{ x: number; y: number }, { x: number; y: number }];
  right: [{ x: number; y: number }, { x: number; y: number }];
  spacing: number;
} {
  const startPegs = opts.startPegs ?? 3;
  const marginX = opts.marginX ?? 28;
  const pad = opts.pad ?? 10;
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

  return {
    left: [
      { x: topLeft, y: opts.topY - 8 },
      { x: botLeft, y: opts.bottomY + 12 },
    ],
    right: [
      { x: topRight, y: opts.topY - 8 },
      { x: botRight, y: opts.bottomY + 12 },
    ],
    spacing,
  };
}
