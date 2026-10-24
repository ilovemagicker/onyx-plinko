"use client";

import { BALL_COSTS } from "@/lib/ball-cost";

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
}: ControlsProps) {
  const buyDisabled = disabled || busy || autoRunning;
  const autoDisabled = disabled || busy;
  const costDisabled = busy || autoRunning;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Ball cost
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
                  ? "rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  : "rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
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
                  ? "rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : "rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
              }
            >
              {s}x
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={buyDisabled}
          onClick={onBuy}
          className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
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
              ? "rounded-xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300"
              : "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {autoRunning ? "STOP" : "AUTO"}
        </button>
      </div>
    </div>
  );
}
