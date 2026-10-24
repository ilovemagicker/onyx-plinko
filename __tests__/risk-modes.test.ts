import { describe, it, expect } from "vitest";
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";
import { DEMO_BIN_WEIGHTS, DEMO_BIN_ODDS_POWER } from "@/lib/bin-odds";
import {
  DEFAULT_RISK,
  RISK_BIN_WEIGHTS,
  RISK_MODE_IDS,
  RISK_MULTIPLIERS,
  RISK_ODDS_POWER,
  getRiskRtp,
  isRiskMode,
} from "@/lib/risk-modes";

describe("risk modes", () => {
  it("exposes low / medium / high", () => {
    expect(RISK_MODE_IDS).toEqual(["low", "medium", "high"]);
    expect(DEFAULT_RISK).toBe("high");
  });

  it("isRiskMode guards", () => {
    expect(isRiskMode("high")).toBe(true);
    expect(isRiskMode("nope")).toBe(false);
  });

  for (const risk of RISK_MODE_IDS) {
    describe(risk, () => {
      const multipliers = RISK_MULTIPLIERS[risk];
      const weights = RISK_BIN_WEIGHTS[risk];

      it("has 17 symmetric bins", () => {
        expect(multipliers).toHaveLength(17);
        expect(weights).toHaveLength(17);
        for (let i = 0; i < 17; i++) {
          expect(multipliers[i]).toBe(multipliers[16 - i]);
          expect(weights[i]).toBeCloseTo(weights[16 - i]!, 12);
        }
      });

      it("weights sum to 1", () => {
        expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      });

      it("RTP in [0.94, 0.99]", () => {
        const rtp = getRiskRtp(risk);
        expect(rtp).toBeGreaterThanOrEqual(0.94);
        expect(rtp).toBeLessThanOrEqual(0.99);
      });

      it("uses positive softening power", () => {
        expect(RISK_ODDS_POWER[risk]).toBeGreaterThan(0);
        expect(RISK_ODDS_POWER[risk]).toBeLessThanOrEqual(1);
      });
    });
  }

  it("high edges are 100x (juiciest)", () => {
    expect(RISK_MULTIPLIERS.high[0]).toBe(100);
    expect(RISK_MULTIPLIERS.high[16]).toBe(100);
    expect(RISK_MULTIPLIERS.high[0]).toBeGreaterThan(RISK_MULTIPLIERS.medium[0]!);
    expect(RISK_MULTIPLIERS.medium[0]).toBeGreaterThan(RISK_MULTIPLIERS.low[0]!);
  });

  it("DEFAULT_MULTIPLIERS mirrors high risk", () => {
    expect(DEFAULT_MULTIPLIERS).toEqual(RISK_MULTIPLIERS.high);
  });

  it("DEMO_BIN_WEIGHTS mirrors high risk weights + power", () => {
    expect(DEMO_BIN_ODDS_POWER).toBe(RISK_ODDS_POWER.high);
    for (let i = 0; i < 17; i++) {
      expect(DEMO_BIN_WEIGHTS[i]).toBeCloseTo(RISK_BIN_WEIGHTS.high[i]!, 12);
    }
  });
});
