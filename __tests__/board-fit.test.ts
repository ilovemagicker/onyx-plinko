import { describe, expect, it } from "vitest";
import {
  BOARD_ASPECT,
  boardSizeChanged,
  fitBoardStage,
} from "@/lib/board-fit";

describe("fitBoardStage", () => {
  it("returns zero for empty slots", () => {
    expect(fitBoardStage(0, 100)).toEqual({ w: 0, h: 0 });
    expect(fitBoardStage(100, 0)).toEqual({ w: 0, h: 0 });
  });

  it("height-limits when slot is wide", () => {
    const { w, h } = fitBoardStage(400, 400);
    expect(h).toBe(400);
    expect(w).toBeCloseTo(400 * BOARD_ASPECT, 5);
  });

  it("width-limits when slot is tall/narrow", () => {
    const { w, h } = fitBoardStage(200, 800);
    expect(w).toBe(200);
    expect(h).toBeCloseTo(200 / BOARD_ASPECT, 5);
  });

  it("preserves aspect", () => {
    const { w, h } = fitBoardStage(390, 600);
    expect(w / h).toBeCloseTo(BOARD_ASPECT, 5);
    expect(w).toBeLessThanOrEqual(390 + 1e-6);
    expect(h).toBeLessThanOrEqual(600 + 1e-6);
  });
});

describe("boardSizeChanged", () => {
  it("ignores sub-pixel jitter", () => {
    expect(
      boardSizeChanged({ w: 100, h: 144.44 }, { w: 100.5, h: 145 }, 2),
    ).toBe(false);
  });

  it("flags real changes", () => {
    expect(
      boardSizeChanged({ w: 100, h: 144 }, { w: 120, h: 173 }, 2),
    ).toBe(true);
  });
});
