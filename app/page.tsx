"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AssetToggle } from "@/components/AssetToggle";
import { Controls } from "@/components/Controls";
import { DemoBanner } from "@/components/DemoBanner";
import { ShellHeader } from "@/components/ShellHeader";
import type { PlinkoBoardHandle } from "@/game/types";
import type { Asset } from "@/lib/assets";
import { DEFAULT_BALL_COST } from "@/lib/ball-cost";
import { applyDrop, creditGuestStart } from "@/lib/ledger";
import { loadBalance, saveBalance } from "@/lib/ledger-storage";
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";

const AUTO_COUNT = 5;

/** Task 8 will replace stub BUY with board.dropBall(). */
function pickStubMultiplier(): number {
  const i = Math.floor(Math.random() * DEFAULT_MULTIPLIERS.length);
  return DEFAULT_MULTIPLIERS[i] ?? 1;
}

const PlinkoBoard = dynamic(() => import("@/components/PlinkoBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)]">
      Loading board…
    </div>
  ),
});

export default function Home() {
  const { publicKey } = useWallet();
  const address = useMemo(
    () => (publicKey ? publicKey.toBase58() : null),
    [publicKey],
  );

  const boardRef = useRef<PlinkoBoardHandle | null>(null);

  const [asset, setAsset] = useState<Asset>("SOL");
  const [balance, setBalance] = useState(() => creditGuestStart());
  const [ballCost, setBallCost] = useState(DEFAULT_BALL_COST);
  const [speed, setSpeed] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // On connect / disconnect / asset change: reload demo balance for identity.
  useEffect(() => {
    const next = loadBalance(address, asset, creditGuestStart());
    setBalance(next);
    setHydrated(true);
  }, [address, asset]);

  // SPEED → animation only (Task 7); Task 8 keeps this.
  useEffect(() => {
    boardRef.current?.setSpeed(speed);
  }, [speed]);

  const onBuy = useCallback(() => {
    // Stub ledger path — real dropBall wiring is Task 8.
    setBalance((prev) => {
      const multiplier = pickStubMultiplier();
      const result = applyDrop(prev, ballCost, multiplier);
      if (!result.ok) {
        setLastResult("Insufficient balance");
        return prev;
      }
      saveBalance(address, asset, result.balance);
      setLastResult(`Landed ${multiplier}x → bal ${result.balance}`);
      return result.balance;
    });
  }, [address, asset, ballCost]);

  const onAuto = useCallback(() => {
    setBalance((prev) => {
      let current = prev;
      let landed = 0;
      let lastMult = 1;
      for (let i = 0; i < AUTO_COUNT; i++) {
        const multiplier = pickStubMultiplier();
        const result = applyDrop(current, ballCost, multiplier);
        if (!result.ok) {
          setLastResult(
            landed === 0
              ? "Insufficient balance"
              : `AUTO stopped after ${landed}; last ${lastMult}x`,
          );
          if (landed > 0) saveBalance(address, asset, current);
          return current;
        }
        current = result.balance;
        lastMult = multiplier;
        landed += 1;
      }
      saveBalance(address, asset, current);
      setLastResult(`AUTO ×${landed}; last ${lastMult}x → bal ${current}`);
      return current;
    });
  }, [address, asset, ballCost]);

  const onAssetChange = useCallback((next: Asset) => {
    setAsset(next);
    setLastResult(null);
  }, []);

  const insufficient = balance < ballCost;
  const disabled = !hydrated || insufficient;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <ShellHeader balance={balance} asset={asset} address={address} />

      <div className="flex items-center justify-between gap-2">
        <AssetToggle asset={asset} onChange={onAssetChange} />
        <p className="text-xs text-[var(--muted)]">
          {address ? "Wallet demo" : "Guest demo"}
        </p>
      </div>

      <DemoBanner />

      <PlinkoBoard apiRef={boardRef} />

      {lastResult ? (
        <p className="text-center text-sm text-[var(--accent)]">{lastResult}</p>
      ) : (
        <p className="text-center text-xs text-[var(--muted)]">
          Board ready — BUY still uses stub multipliers until Task 8.
        </p>
      )}

      <Controls
        ballCost={ballCost}
        onBallCost={setBallCost}
        onBuy={onBuy}
        onAuto={onAuto}
        speed={speed}
        onSpeed={setSpeed}
        disabled={disabled}
      />

      {insufficient && hydrated ? (
        <p className="text-center text-xs text-[var(--muted)]">
          Insufficient {asset} for ball cost {ballCost}.
        </p>
      ) : null}
    </main>
  );
}
