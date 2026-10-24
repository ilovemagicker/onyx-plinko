"use client";

import { BALL_COSTS } from "@/lib/ball-cost";

export const SPEEDS = [1, 1.5, 2, 3, 5] as const;
export type Speed = (typeof SPEEDS)[number];

export type ControlsProps = {
  ballCost: number;
  onBallCost: (cost: number) => void;
  onBuy: () => void;
  onAuto: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
  /** Disables BUY / AUTO (e.g. insufficient balance or not hydrated). */
  disabled?: boolean;
};

export function Controls({
  ballCost,
  onBallCost,
  onBuy,
  onAuto,
  speed,
  onSpeed,
  disabled = false,
}: ControlsProps) {
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
              onClick={() => onBallCost(c)}
              className={
                active
                  ? "rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : "rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
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
          disabled={disabled}
          onClick={onBuy}
          className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          BUY BALLS
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onAuto}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          AUTO
        </button>
      </div>
    </div>
  );
}
