"use client";

import type { Asset } from "@/lib/assets";

export type ShellHeaderProps = {
  balance: number;
  asset: Asset;
  onConnectClick?: () => void;
};

function formatBalance(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

export function ShellHeader({
  balance,
  asset,
  onConnectClick,
}: ShellHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Onyx Labs
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Plinko</h1>
      </div>

      <div className="flex flex-col items-end gap-2">
        <p className="text-sm tabular-nums text-[var(--foreground)]">
          <span className="text-[var(--muted)]">Bal </span>
          {formatBalance(balance)}{" "}
          <span className="font-medium text-[var(--accent)]">{asset}</span>
        </p>
        <button
          type="button"
          onClick={onConnectClick}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          Connect
        </button>
      </div>
    </header>
  );
}
