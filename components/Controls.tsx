"use client";

import {
  BALL_COUNT_PRESETS,
  DEFAULT_BALL_COUNT,
  MAX_BALL_COUNT,
  MIN_BALL_COUNT,
  clampBallCount,
} from "@/lib/ball-count";
import { BALL_COSTS } from "@/lib/ball-cost";
import {
  RISK_LABELS,
  RISK_MODE_IDS,
  type RiskMode,
} from "@/lib/risk-modes";

export const SPEEDS = [1, 1.5, 2, 3, 5] as const;
export type Speed = (typeof SPEEDS)[number];

export type ControlsProps = {
  ballCost: number;
  onBallCost: (cost: number) => void;
  ballCount: number;
  onBallCount: (count: number) => void;
  onBuy: () => void;
  onAuto: () => void;
  /** When AUTO is running, STOP calls this instead of starting another run. */
  onStopAuto?: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
  /** Disables BUY / AUTO (e.g. insufficient balance, board not ready, not hydrated). */
  disabled?: boolean;
  /**
   * True while AUTO is running OR a same-frame BUY debounce is active.
   * Does NOT lock BUY for the whole multi-ball flight — consecutive clicks allowed.
   */
  busy?: boolean;
  /** True while AUTO loop is running — BUY disabled; AUTO becomes STOP. */
  autoRunning?: boolean;
  /** Balls currently on the board (for label hint). */
  ballsInFlight?: number;
  risk: RiskMode;
  onRisk: (risk: RiskMode) => void;
};

function chipClass(active: boolean, extraActive = ""): string {
  const base =
    "min-w-8 rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-9 sm:px-3 sm:py-1.5 sm:text-xs";
  if (active) {
    return `${base} plinko-chip-active ${extraActive}`.trim();
  }
  return `${base} plinko-chip`;
}

export function Controls({
  ballCost,
  onBallCost,
  ballCount,
  onBallCount,
  onBuy,
  onAuto,
  onStopAuto,
  speed,
  onSpeed,
  disabled = false,
  busy = false,
  autoRunning = false,
  ballsInFlight = 0,
  risk,
  onRisk,
}: ControlsProps) {
  // BUY stays clickable while balls fly; only block during AUTO / insufficient / debounce.
  const buyDisabled = disabled || autoRunning || busy;
  const autoDisabled = disabled || busy || ballsInFlight > 0;
  const costDisabled = autoRunning;
  const riskDisabled = autoRunning || ballsInFlight > 0;

  const buyLabel =
    ballCount > 1 ? `BUY ×${ballCount}` : "BUY BALLS";

  return (
    <div className="plinko-panel flex flex-col gap-2 rounded-2xl p-2.5 sm:gap-2.5 sm:p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brass)]/80 sm:w-14 sm:text-[10px]">
          Risk
        </span>
        {RISK_MODE_IDS.map((id) => {
          const active = id === risk;
          const label = RISK_LABELS[id];
          const activeExtra =
            id === "high"
              ? "plinko-chip-risk-high"
              : id === "medium"
                ? "plinko-chip-risk-med"
                : "";
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              disabled={riskDisabled}
              onClick={() => onRisk(id)}
              className={chipClass(active, activeExtra)}
            >
              {label.zh}
              <span className="ml-1 opacity-60">{label.en}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brass)]/80 sm:w-14 sm:text-[10px]">
          Cost
        </span>
        {BALL_COSTS.map((c) => {
          const active = c === ballCost;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              disabled={costDisabled}
              onClick={() => onBallCost(c)}
              className={chipClass(active)}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brass)]/80 sm:w-14 sm:text-[10px]">
          Balls
        </span>
        {BALL_COUNT_PRESETS.map((n) => {
          const active = n === ballCount;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              disabled={costDisabled}
              onClick={() => onBallCount(n)}
              className={chipClass(active)}
            >
              {n}
            </button>
          );
        })}
        <label className="flex items-center gap-1">
          <span className="sr-only">Custom ball count</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BALL_COUNT}
            max={MAX_BALL_COUNT}
            value={ballCount}
            disabled={costDisabled}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return;
              onBallCount(clampBallCount(Number(raw)));
            }}
            onBlur={(e) => {
              onBallCount(clampBallCount(Number(e.target.value) || DEFAULT_BALL_COUNT));
            }}
            className="w-12 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-center text-[11px] text-[var(--foreground)] outline-none focus:border-[var(--brass)]/60 disabled:cursor-not-allowed disabled:opacity-50 sm:w-14 sm:text-xs"
            aria-label={`Custom balls (${MIN_BALL_COUNT}–${MAX_BALL_COUNT})`}
            title={`Custom 1–${MAX_BALL_COUNT}`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brass)]/80 sm:w-14 sm:text-[10px]">
          Speed
        </span>
        {SPEEDS.map((s) => {
          const active = s === speed;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => onSpeed(s)}
              className={chipClass(active)}
            >
              {s}x
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          type="button"
          disabled={buyDisabled}
          onClick={onBuy}
          className="rounded-xl bg-gradient-to-b from-[#d8ff6a] to-[var(--accent)] px-3 py-2.5 text-sm font-bold tracking-wide text-[var(--background)] shadow-[0_0_24px_-6px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:py-3"
        >
          {buyLabel}
        </button>
        <button
          type="button"
          disabled={autoRunning ? false : autoDisabled}
          onClick={autoRunning ? onStopAuto : onAuto}
          aria-pressed={autoRunning}
          className={
            autoRunning
              ? "rounded-xl border border-red-500/70 bg-red-500/20 px-3 py-2.5 text-sm font-bold tracking-wide text-red-200 sm:py-3"
              : "rounded-xl border border-[var(--brass)]/30 bg-[var(--surface-2)] px-3 py-2.5 text-sm font-bold tracking-wide text-[var(--foreground)] transition hover:border-[var(--brass)]/55 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
          }
        >
          {autoRunning ? "STOP" : "AUTO"}
        </button>
      </div>
    </div>
  );
}
