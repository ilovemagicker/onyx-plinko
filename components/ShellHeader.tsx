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
          onClick={onClick}
          disabled={disconnecting}
          title={connectTitle}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50"
        >
          {label}
        </button>
      </div>
    </header>
  );
}
