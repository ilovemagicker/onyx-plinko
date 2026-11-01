/** Logical Plinko board aspect (matches Phaser BOARD_WIDTH/HEIGHT). */
export const BOARD_LOGIC_W = 360;
export const BOARD_LOGIC_H = 520;
export const BOARD_ASPECT = BOARD_LOGIC_W / BOARD_LOGIC_H;

/** Largest 360×520 box that fits inside a CSS-pixel slot. */
export function fitBoardStage(
  slotW: number,
  slotH: number,
): { w: number; h: number } {
  if (!(slotW > 0) || !(slotH > 0)) return { w: 0, h: 0 };
  if (slotW / slotH > BOARD_ASPECT) {
    const h = slotH;
    return { w: h * BOARD_ASPECT, h };
  }
  const w = slotW;
  return { w, h: w / BOARD_ASPECT };
}

/** True when a measured size change is large enough to restyle the stage. */
export function boardSizeChanged(
  prev: { w: number; h: number },
  next: { w: number; h: number },
  epsilonPx = 2,
): boolean {
  return (
    Math.abs(next.w - prev.w) >= epsilonPx ||
    Math.abs(next.h - prev.h) >= epsilonPx
  );
}
