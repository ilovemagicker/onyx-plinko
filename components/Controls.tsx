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
    <div className="flex flex-col gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Risk
        </span>
        {RISK_MODE_IDS.map((id) => {
          const active = id === risk;
          const label = RISK_LABELS[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              disabled={riskDisabled}
              onClick={() => onRisk(id)}
              className={
                active
                  ? id === "high"
                    ? "min-w-12 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 ring-1 ring-red-400/80 disabled:cursor-not-allowed disabled:opacity-50"
                    : id === "medium"
                      ? "min-w-12 rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/80 disabled:cursor-not-allowed disabled:opacity-50"
                      : "min-w-12 rounded-full bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  : "min-w-12 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {label.zh}
              <span className="ml-1 opacity-60">{label.en}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
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
              className={
                active
                  ? "min-w-9 rounded-full bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  : "min-w-9 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
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
              className={
                active
                  ? "min-w-9 rounded-full bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  : "min-w-9 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {n}
            </button>
          );
        })}
        <label className="flex items-center gap-1.5">
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
            className="w-14 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-center text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Custom balls (${MIN_BALL_COUNT}–${MAX_BALL_COUNT})`}
            title={`Custom 1–${MAX_BALL_COUNT}`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
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
              className={
                active
                  ? "min-w-9 rounded-full bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : "min-w-9 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
              }
            >
              {s}x
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-0.5">
        <button
          type="button"
          disabled={buyDisabled}
          onClick={onBuy}
          className="rounded-xl bg-[var(--accent)] px-4 py-3.5 text-sm font-bold tracking-wide text-[var(--background)] shadow-[0_0_24px_-6px_var(--glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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
              ? "rounded-xl border border-red-500/70 bg-red-500/20 px-4 py-3.5 text-sm font-bold tracking-wide text-red-200"
              : "rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-sm font-bold tracking-wide text-[var(--foreground)] transition hover:border-[var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {autoRunning ? "STOP" : "AUTO"}
        </button>
      </div>
    </div>
  );
}

