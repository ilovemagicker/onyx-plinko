"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { Asset } from "@/lib/assets";

export type ShellHeaderProps = {
  balance: number;
  asset: Asset;
  /** Connected wallet address (base58) or null for guest. */
  address?: string | null;
};

function formatBalance(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ShellHeader({ balance, asset, address = null }: ShellHeaderProps) {
  const { connected, disconnecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const onClick = useCallback(() => {
    if (connected) {
      void disconnect();
      return;
    }
    setVisible(true);
  }, [connected, disconnect, setVisible]);

  const label = connected && address ? truncateAddress(address) : "Connect";

  const connectTitle =
    connected && address
      ? `${address} — click to disconnect (demo identity for WLD + SOL)`
      : asset === "WLD"
        ? "Connect Phantom for demo identity (WLD + SOL). World App connect in v1.1"
        : "Connect Phantom (demo identity for WLD + SOL)";

  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
          Onyx Labs
        </p>
        <h1 className="bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)] to-[var(--accent)] bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Plinko
        </h1>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(200,245,66,0.06)]">
          <p className="text-sm tabular-nums text-[var(--foreground)]">
            <span className="text-[var(--muted)]">Bal </span>
            {formatBalance(balance)}{" "}
            <span className="font-semibold text-[var(--accent)]">{asset}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disconnecting}
          title={connectTitle}
          className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)]/60 hover:shadow-[0_0_16px_-4px_var(--glow)] disabled:opacity-50"
        >
          {label}
        </button>
      </div>
    </header>
  );
}
