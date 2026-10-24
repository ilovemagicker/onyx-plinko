import type { Asset } from "./assets";

export type LedgerKey = { address: string | null; asset: Asset }; // null address = guest

export function applyDrop(
  balance: number,
  ballCost: number,
  multiplier: number,
): { ok: true; balance: number } | { ok: false; reason: "insufficient" } {
  if (balance < ballCost) return { ok: false, reason: "insufficient" };
  const next = balance - ballCost + ballCost * multiplier;
  return { ok: true, balance: Number(next.toFixed(8)) };
}

export function creditGuestStart(balance = 1000): number {
  return balance;
}
