"use client";

import type { JuiceTier } from "@/lib/juice";

export type JuiceOverlayProps = {
  tier: JuiceTier;
  label: string | null;
  streak: number;
  /** Bumps to retrigger CSS animation. */
  pulseKey: number;
};

export function JuiceOverlay({ tier, label, streak, pulseKey }: JuiceOverlayProps) {
  return (
    <>
      {tier !== "none" ? (
        <div
          key={`flash-${pulseKey}`}
          aria-hidden
          className={
            tier === "jackpot"
              ? "pointer-events-none fixed inset-0 z-40 animate-plinko-flash-jackpot"
              : tier === "big"
                ? "pointer-events-none fixed inset-0 z-40 animate-plinko-flash-big"
                : "pointer-events-none fixed inset-0 z-40 animate-plinko-flash-nice"
          }
        />
      ) : null}

      {label ? (
        <div
          key={`toast-${pulseKey}`}
          className={
            tier === "jackpot"
              ? "pointer-events-none fixed inset-x-0 top-[18%] z-[45] flex justify-center animate-plinko-toast"
              : "pointer-events-none fixed inset-x-0 top-[22%] z-[45] flex justify-center animate-plinko-toast"
          }
        >
          <p
            className={
              tier === "jackpot"
                ? "rounded-2xl border border-yellow-300/80 bg-yellow-400/20 px-5 py-3 text-2xl font-black tracking-[0.2em] text-yellow-100 shadow-[0_0_40px_rgba(250,204,21,0.55)]"
                : tier === "big"
                  ? "rounded-2xl border border-amber-300/70 bg-amber-500/20 px-5 py-2.5 text-xl font-extrabold tracking-[0.18em] text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.45)]"
                  : "rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-4 py-2 text-sm font-bold tracking-[0.14em] text-[var(--accent)]"
            }
          >
            {label}
          </p>
        </div>
      ) : null}

      {streak >= 2 ? (
        <div className="pointer-events-none absolute right-3 top-3 z-30">
          <p
            className={
              streak >= 10
                ? "rounded-full border border-yellow-300/60 bg-yellow-400/15 px-3 py-1 text-xs font-bold tracking-wide text-yellow-100 shadow-[0_0_16px_rgba(250,204,21,0.35)]"
                : streak >= 5
                  ? "rounded-full border border-amber-300/50 bg-amber-500/15 px-3 py-1 text-xs font-bold tracking-wide text-amber-100"
                  : "rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[var(--accent)]"
            }
          >
            連擊 ×{streak}
          </p>
        </div>
      ) : null}
    </>
  );
}
