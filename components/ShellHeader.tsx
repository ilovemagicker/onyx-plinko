"use client";

import { useCallback, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { Asset } from "@/lib/assets";

export type ShellHeaderProps = {
  balance: number;
  asset: Asset;
  address?: string | null;
  muted?: boolean;
  onMuteToggle?: () => void;
  compact?: boolean;
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

  const titleClass = compact
    ? "plinko-title text-2xl sm:text-3xl"
    : "plinko-title text-4xl";

  return (
    <header className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-sky-700">
          Onyx Labs
        </p>
        <h1 className={titleClass}>Plinko</h1>
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
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white/85 text-sm shadow-md transition hover:scale-105"
          >
            <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
          </button>
        ) : null}
        <div className="rounded-full border-2 border-white bg-gradient-to-b from-white to-sky-100 px-2.5 py-1 shadow-md">
          <p className="text-xs font-bold tabular-nums text-slate-900 sm:text-sm">
            <span className="text-sky-700">Bal </span>
            {formatBalance(balance)}{" "}
            <span className="text-amber-600">{asset}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disconnecting}
          title={connectTitle}
          className="rounded-full border-2 border-white bg-gradient-to-b from-pink-300 to-fuchsia-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-50 sm:px-3 sm:text-xs"
        >
          {label}
        </button>
      </div>
    </header>
  );
}
