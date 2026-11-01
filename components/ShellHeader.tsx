"use client";

import { useCallback, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { Asset } from "@/lib/assets";

export type ShellHeaderProps = {
  balance: number;
  asset: Asset;
  /** Connected wallet address (base58) or null for guest. */
  address?: string | null;
  /** When set, shows mute / unmute control. */
  muted?: boolean;
  onMuteToggle?: () => void;
  /** Compact one-screen header. */
  compact?: boolean;
  /** Optional trailing slot (e.g. asset toggle). */
  trailing?: ReactNode;
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

export function ShellHeader({
  balance,
  asset,
  address = null,
  muted,
  onMuteToggle,
  compact = false,
  trailing,
}: ShellHeaderProps) {
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
    <header className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-[var(--brass)]/80">
          Onyx Labs
        </p>
        <h1
          className={
            compact
              ? "bg-gradient-to-r from-[var(--foreground)] via-[#f0e6d2] to-[var(--brass)] bg-clip-text text-xl font-semibold tracking-tight text-transparent sm:text-2xl"
              : "bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)] to-[var(--accent)] bg-clip-text text-3xl font-semibold tracking-tight text-transparent"
          }
        >
          Plinko
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {trailing}
        {typeof muted === "boolean" && onMuteToggle ? (
          <button
            type="button"
            onClick={onMuteToggle}
            aria-pressed={muted}
            aria-label={muted ? "開啟聲音" : "靜音"}
            title={muted ? "開啟聲音" : "靜音"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--foreground)] transition hover:border-[var(--brass)]/60"
          >
            <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
          </button>
        ) : null}
        <div className="rounded-full border border-[var(--brass)]/25 bg-[var(--surface)]/90 px-2.5 py-1 shadow-[inset_0_0_0_1px_rgba(212,175,118,0.08)]">
          <p className="text-xs tabular-nums text-[var(--foreground)] sm:text-sm">
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
          className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)] transition hover:border-[var(--brass)]/50 disabled:opacity-50 sm:px-3 sm:text-xs"
        >
          {label}
        </button>
      </div>
    </header>
  );
}
