"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AssetToggle } from "@/components/AssetToggle";
import { Controls } from "@/components/Controls";
import { DemoBanner } from "@/components/DemoBanner";
import { ShellHeader } from "@/components/ShellHeader";
import { WldHint } from "@/components/WldHint";
import type { PlinkoBoardHandle } from "@/game/types";
import type { Asset } from "@/lib/assets";
import { DEFAULT_BALL_COST } from "@/lib/ball-cost";
import { applyDrop, creditGuestStart } from "@/lib/ledger";
import { loadBalance, saveBalance } from "@/lib/ledger-storage";

/** Sequential AUTO drops per run (plan: ~10). */
const AUTO_COUNT = 10;

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
  const balanceRef = useRef(creditGuestStart());
  const addressRef = useRef<string | null>(null);
  const assetRef = useRef<Asset>("SOL");
  const ballCostRef = useRef(DEFAULT_BALL_COST);
  const stopAutoRef = useRef(false);
  const inFlightRef = useRef(false);

  const [asset, setAsset] = useState<Asset>("SOL");
  const [balance, setBalance] = useState(() => creditGuestStart());
  const [ballCost, setBallCost] = useState(DEFAULT_BALL_COST);
  const [speed, setSpeed] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  useEffect(() => {
    assetRef.current = asset;
  }, [asset]);
  useEffect(() => {
    ballCostRef.current = ballCost;
  }, [ballCost]);

  // Same connected address (or guest) keys BOTH WLD and SOL buckets —
  // one identity, two balances. Reload when identity changes; wait until
  // idle so mid-drop settlement (bound to start-of-drop address) is not
  // clobbered.
  useEffect(() => {
    if (busy || autoRunning) return;
    const next = loadBalance(address, asset, creditGuestStart());
    balanceRef.current = next;
    setBalance(next);
    setHydrated(true);
  }, [address, asset, busy, autoRunning]);

  // Spec: wallet switch / disconnect → stop AUTO; in-flight ball still finishes.
  // Harmless while idle — onAuto resets this to false at start.
  useEffect(() => {
    stopAutoRef.current = true;
  }, [address, asset]);

  useEffect(() => {
    boardRef.current?.setSpeed(speed);
  }, [speed]);

  const onBoardReady = useCallback(() => {
    setBoardReady(true);
    boardRef.current?.setSpeed(speed);
  }, [speed]);

  /**
   * One ball: check balance → drop → applyDrop → save.
   * Settlement address/asset/cost are snapshotted at start (spec: bind to
   * identity at drop start even if wallet switches mid-animation).
   */
  const runOneDrop = useCallback(async (): Promise<
    | { ok: true; multiplier: number; balance: number }
    | {
        ok: false;
        reason: "insufficient" | "no-board" | "error";
        message?: string;
      }
  > => {
    const board = boardRef.current;
    if (!board) {
      return { ok: false, reason: "no-board", message: "Board not ready" };
    }

    const cost = ballCostRef.current;
    const settleAddress = addressRef.current;
    const settleAsset = assetRef.current;
    const prev = balanceRef.current;
    if (prev < cost) {
      return { ok: false, reason: "insufficient" };
    }

    let multiplier: number;
    try {
      const landed = await board.dropBall();
      multiplier = landed.multiplier;
    } catch (err) {
      console.error("dropBall failed", err);
      return {
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : "Drop failed",
      };
    }

    const result = applyDrop(prev, cost, multiplier);
    if (!result.ok) {
      return { ok: false, reason: "insufficient" };
    }

    balanceRef.current = result.balance;
    setBalance(result.balance);
    saveBalance(settleAddress, settleAsset, result.balance);
    return { ok: true, multiplier, balance: result.balance };
  }, []);

  const onBuy = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!boardRef.current) {
      setLastResult("Board not ready");
      return;
    }
    if (balanceRef.current < ballCostRef.current) {
      setLastResult("Insufficient balance");
      return;
    }

    inFlightRef.current = true;
    setBusy(true);
    setLastResult(null);
    try {
      const outcome = await runOneDrop();
      if (!outcome.ok) {
        setLastResult(
          outcome.reason === "insufficient"
            ? "Insufficient balance"
            : (outcome.message ?? "Drop failed"),
        );
        return;
      }
      setLastResult(`Landed ${outcome.multiplier}x → bal ${outcome.balance}`);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [runOneDrop]);

  const onStopAuto = useCallback(() => {
    stopAutoRef.current = true;
  }, []);

  const onAuto = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!boardRef.current) {
      setLastResult("Board not ready");
      return;
    }
    if (balanceRef.current < ballCostRef.current) {
      setLastResult("Insufficient balance");
      return;
    }

    stopAutoRef.current = false;
    inFlightRef.current = true;
    setBusy(true);
    setAutoRunning(true);
    setLastResult(`AUTO ×${AUTO_COUNT}…`);

    let landed = 0;
    let lastMult = 1;
    let stoppedEarly = false;

    try {
      for (let i = 0; i < AUTO_COUNT; i++) {
        if (stopAutoRef.current) {
          stoppedEarly = true;
          break;
        }
        if (balanceRef.current < ballCostRef.current) {
          stoppedEarly = true;
          break;
        }

        const outcome = await runOneDrop();
        if (!outcome.ok) {
          stoppedEarly = true;
          if (landed === 0) {
            setLastResult(
              outcome.reason === "insufficient"
                ? "Insufficient balance"
                : (outcome.message ?? "AUTO failed"),
            );
          } else {
            setLastResult(
              `AUTO stopped after ${landed}; last ${lastMult}x → bal ${balanceRef.current}`,
            );
          }
          return;
        }
        landed += 1;
        lastMult = outcome.multiplier;
        setLastResult(
          `AUTO ${landed}/${AUTO_COUNT}; last ${lastMult}x → bal ${outcome.balance}`,
        );
      }

      if (landed === 0) {
        setLastResult(
          stopAutoRef.current ? "AUTO cancelled" : "Insufficient balance",
        );
      } else if (stoppedEarly || stopAutoRef.current) {
        setLastResult(
          `AUTO stopped after ${landed}; last ${lastMult}x → bal ${balanceRef.current}`,
        );
      } else {
        setLastResult(
          `AUTO ×${landed}; last ${lastMult}x → bal ${balanceRef.current}`,
        );
      }
    } finally {
      stopAutoRef.current = false;
      inFlightRef.current = false;
      setBusy(false);
      setAutoRunning(false);
    }
  }, [runOneDrop]);

  const onAssetChange = useCallback(
    (next: Asset) => {
      if (inFlightRef.current || autoRunning) return;
      setAsset(next);
      setLastResult(null);
    },
    [autoRunning],
  );

  const insufficient = balance < ballCost;
  const disabled = !hydrated || !boardReady || insufficient;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <ShellHeader balance={balance} asset={asset} address={address} />

      <div className="flex items-center justify-between gap-2">
        <AssetToggle asset={asset} onChange={onAssetChange} />
        <p className="text-xs text-[var(--muted)]">
          {address
            ? asset === "WLD"
              ? "WLD demo · same wallet id"
              : "Wallet demo"
            : asset === "WLD"
              ? "Guest WLD demo"
              : "Guest demo"}
        </p>
      </div>

      <DemoBanner />

      {asset === "WLD" ? <WldHint /> : null}

      <PlinkoBoard apiRef={boardRef} onReady={onBoardReady} />

      {lastResult ? (
        <p className="text-center text-sm text-[var(--accent)]">{lastResult}</p>
      ) : (
        <p className="text-center text-xs text-[var(--muted)]">
          {!boardReady
            ? "Loading board…"
            : asset === "WLD"
              ? "Tap BUY BALLS — WLD chips are demo; World connect in v1.1."
              : "Tap BUY BALLS to drop — demo chips only."}
        </p>
      )}

      <Controls
        ballCost={ballCost}
        onBallCost={setBallCost}
        onBuy={() => {
          void onBuy();
        }}
        onAuto={() => {
          void onAuto();
        }}
        onStopAuto={onStopAuto}
        speed={speed}
        onSpeed={setSpeed}
        disabled={disabled}
        busy={busy}
        autoRunning={autoRunning}
      />

      {insufficient && hydrated ? (
        <p className="text-center text-xs text-[var(--muted)]">
          Insufficient {asset} for ball cost {ballCost}.
        </p>
      ) : null}

      <footer className="mt-auto border-t border-[var(--border)] pt-4 text-center text-xs text-[var(--muted)]">
        <p className="font-medium text-[var(--accent)]">Demo — not real funds</p>
        <p className="mt-1">Onyx Labs · plinko.onyxlab.dev</p>
        <p className="mt-1">No wallet signing or on-chain transfers in v1.</p>
      </footer>
    </main>
  );
}
