"use client";

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
  onBuy: () => void;
  onAuto: () => void;
  /** When AUTO is running, STOP calls this instead of starting another run. */
  onStopAuto?: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
  /** Disables BUY / AUTO (e.g. insufficient balance, board not ready, not hydrated). */
  disabled?: boolean;
  /** True while a single BUY drop is in flight — blocks double-debit. */
  busy?: boolean;
  /** True while AUTO loop is running — BUY disabled; AUTO becomes STOP. */
  autoRunning?: boolean;
  risk: RiskMode;
  onRisk: (risk: RiskMode) => void;
};

export function Controls({
  ballCost,
  onBallCost,
  onBuy,
  onAuto,
  onStopAuto,
  speed,
  onSpeed,
  disabled = false,
  busy = false,
  autoRunning = false,
  risk,
  onRisk,
}: ControlsProps) {
  const buyDisabled = disabled || busy || autoRunning;
  const autoDisabled = disabled || busy;
  const costDisabled = busy || autoRunning;
  const riskDisabled = busy || autoRunning;

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
          {busy && !autoRunning ? "DROPPING…" : "BUY BALLS"}
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
