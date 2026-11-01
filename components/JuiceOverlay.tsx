"use client";

import type { JuiceTier } from "@/lib/juice";

export type JuiceOverlayProps = {
  tier: JuiceTier;
  label: string | null;
  streak: number;
  pulseKey: number;
};

export function JuiceOverlay({ tier, label, streak: _streak, pulseKey }: JuiceOverlayProps) {
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
              ? "pointer-events-none fixed inset-x-0 top-[16%] z-[45] flex justify-center animate-plinko-toast"
              : "pointer-events-none fixed inset-x-0 top-[20%] z-[45] flex justify-center animate-plinko-toast"
          }
        >
          <p
            className={
              tier === "jackpot"
                ? "rounded-2xl border-4 border-white bg-gradient-to-b from-[#ffe566] to-[#ffb020] px-5 py-3 text-2xl font-black tracking-[0.16em] text-[#5a3a00] shadow-[0_8px_32px_rgba(255,180,0,0.65)]"
                : tier === "big"
                  ? "rounded-2xl border-4 border-white bg-gradient-to-b from-[#ff8fd6] to-[#ff4fd8] px-5 py-2.5 text-xl font-extrabold tracking-[0.14em] text-white shadow-[0_8px_28px_rgba(255,79,216,0.5)]"
                  : "rounded-xl border-2 border-white bg-gradient-to-b from-[#9dff7a] to-[#2fd45a] px-4 py-2 text-sm font-extrabold tracking-[0.12em] text-white shadow-lg"
            }
          >
            {label}
          </p>
        </div>
      ) : null}
    </>
  );
}
