"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AssetToggle } from "@/components/AssetToggle";
import { Controls } from "@/components/Controls";
import { DemoBanner } from "@/components/DemoBanner";
import { JuiceOverlay } from "@/components/JuiceOverlay";
import { ShellHeader } from "@/components/ShellHeader";
import type { PlinkoBoardHandle } from "@/game/types";
import type { Asset } from "@/lib/assets";
import {
  DEFAULT_BALL_COUNT,
  MAX_CONCURRENT_BALLS,
  clampBallCount,
} from "@/lib/ball-count";
import { DEFAULT_BALL_COST } from "@/lib/ball-cost";
import {
  isStreakMilestone,
  juiceLabel,
  juiceTierForMultiplier,
  nextStreak,
  type JuiceTier,
} from "@/lib/juice";
import {
  initSfxMuteFromStorage,
  playStreak,
  setMuted,
  unlock as unlockSfx,
} from "@/lib/sfx";
import { applyDrop, creditGuestStart } from "@/lib/ledger";
import { loadBalance, saveBalance } from "@/lib/ledger-storage";
import {
  DEFAULT_RISK,
  getRiskMultipliers,
  getRiskWeights,
  loadStoredRisk,
  saveStoredRisk,
  type RiskMode,
} from "@/lib/risk-modes";

/** Sequential AUTO drops per run (plan: ~10). Each step = 1 ball. */
const AUTO_COUNT = 10;

/** Micro-stagger between spawns in one BUY batch (ms). */
const SPAWN_STAGGER_MS = 45;

/** Same-frame / double-tap debounce for BUY (ms). */
const BUY_DEBOUNCE_MS = 80;

const PlinkoBoard = dynamic(() => import("@/components/PlinkoBoard"), {
  ssr: false,
  loading: () => (
    <div className="plinko-board-frame flex h-full min-h-[180px] items-center justify-center rounded-2xl text-xs text-[var(--muted)]">
      Loading board…
    </div>
  ),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

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
  const ballCountRef = useRef(DEFAULT_BALL_COUNT);
  const stopAutoRef = useRef(false);
  const buyDebounceRef = useRef(false);
  const autoInFlightRef = useRef(false);
  const streakRef = useRef(0);
  /** Cost reserved for balls spawned but not yet settled — prevents overspend on multi-click. */
  const committedCostRef = useRef(0);
  const ballsInFlightRef = useRef(0);
  /** Serialize ledger applies so concurrent lands don't race balance. */
  const settleMutexRef = useRef(Promise.resolve());

  const [asset, setAsset] = useState<Asset>("SOL");
  const [balance, setBalance] = useState(() => creditGuestStart());
  const [ballCost, setBallCost] = useState(DEFAULT_BALL_COST);
  const [ballCount, setBallCount] = useState(DEFAULT_BALL_COUNT);
  const [speed, setSpeed] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [buyDebouncing, setBuyDebouncing] = useState(false);
  const [ballsInFlight, setBallsInFlight] = useState(0);
  const [committedCost, setCommittedCost] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskMode>(DEFAULT_RISK);
  const [streak, setStreak] = useState(0);
  const [juiceTier, setJuiceTier] = useState<JuiceTier>("none");
  const [juiceText, setJuiceText] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [muted, setMutedState] = useState(false);

  const multipliers = useMemo(() => getRiskMultipliers(risk), [risk]);
  const binWeights = useMemo(() => getRiskWeights(risk), [risk]);

  useEffect(() => {
    setRisk(loadStoredRisk(DEFAULT_RISK));
    setMutedState(initSfxMuteFromStorage());
  }, []);

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
  useEffect(() => {
    ballCountRef.current = ballCount;
  }, [ballCount]);
  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);
  useEffect(() => {
    setCommittedCost(committedCostRef.current);
  }, [ballsInFlight, balance]);

  // Same connected address (or guest) keys BOTH WLD and SOL buckets —
  // one identity, two balances. Reload when identity changes; wait until
  // idle so mid-drop settlement (bound to start-of-drop address) is not
  // clobbered.
  useEffect(() => {
    if (autoRunning || ballsInFlight > 0) return;
    const next = loadBalance(address, asset, creditGuestStart());
    balanceRef.current = next;
    setBalance(next);
    setHydrated(true);
  }, [address, asset, autoRunning, ballsInFlight]);

  // Spec: wallet switch / disconnect → stop AUTO; in-flight ball still finishes.
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

  const triggerJuice = useCallback((multiplier: number) => {
    const next = nextStreak(streakRef.current, multiplier);
    streakRef.current = next;
    setStreak(next);

    const tier = juiceTierForMultiplier(multiplier);
    let label = juiceLabel(tier);
    if (isStreakMilestone(next) && (!label || tier === "nice")) {
      label = next >= 10 ? `連擊 ×${next}!` : label ?? `連擊 ×${next}`;
    }
    if (isStreakMilestone(next)) {
      playStreak(next);
    }
    setJuiceTier(tier);
    setJuiceText(label);
    if (tier !== "none" || isStreakMilestone(next)) {
      setPulseKey((k) => k + 1);
    }
    window.setTimeout(() => {
      setJuiceTier("none");
      setJuiceText(null);
    }, tier === "jackpot" ? 1600 : tier === "big" ? 1200 : 800);
  }, []);

  const bumpFlight = useCallback((delta: number) => {
    ballsInFlightRef.current = Math.max(0, ballsInFlightRef.current + delta);
    setBallsInFlight(ballsInFlightRef.current);
  }, []);

  /**
   * Queue one ledger apply. Concurrent physics lands serialize here.
   */
  const enqueueSettle = useCallback(
    (args: {
      cost: number;
      multiplier: number;
      settleAddress: string | null;
      settleAsset: Asset;
    }): Promise<
      | { ok: true; balance: number; multiplier: number }
      | { ok: false; reason: "insufficient" }
    > => {
      const run = async () => {
        const prev = balanceRef.current;
        const result = applyDrop(prev, args.cost, args.multiplier);
        // Release reservation regardless — ball left the board.
        committedCostRef.current = Math.max(
          0,
          committedCostRef.current - args.cost,
        );
        setCommittedCost(committedCostRef.current);
        bumpFlight(-1);

        if (!result.ok) {
          return { ok: false as const, reason: "insufficient" as const };
        }

        balanceRef.current = result.balance;
        setBalance(result.balance);
        saveBalance(args.settleAddress, args.settleAsset, result.balance);
        triggerJuice(args.multiplier);
        return {
          ok: true as const,
          balance: result.balance,
          multiplier: args.multiplier,
        };
      };

      const next = settleMutexRef.current.then(run, run);
      settleMutexRef.current = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
    [bumpFlight, triggerJuice],
  );

  /**
   * Drop one ball + settle via mutex. Snapshots cost/identity at call time.
   * Does not check balance itself — caller reserves committed cost.
   */
  const dropAndSettle = useCallback(async (): Promise<
    | { ok: true; multiplier: number; balance: number }
    | {
        ok: false;
        reason: "no-board" | "error" | "insufficient";
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

    bumpFlight(1);

    let multiplier: number;
    try {
      const landed = await board.dropBall();
      multiplier = landed.multiplier;
    } catch (err) {
      console.error("dropBall failed", err);
      committedCostRef.current = Math.max(
        0,
        committedCostRef.current - cost,
      );
      setCommittedCost(committedCostRef.current);
      bumpFlight(-1);
      return {
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : "Drop failed",
      };
    }

    return enqueueSettle({
      cost,
      multiplier,
      settleAddress,
      settleAsset,
    });
  }, [bumpFlight, enqueueSettle]);

  /**
   * AUTO / single-path helper: check available balance, reserve, drop one.
   */
  const runOneDrop = useCallback(async (): Promise<
    | { ok: true; multiplier: number; balance: number }
    | {
        ok: false;
        reason: "insufficient" | "no-board" | "error";
        message?: string;
      }
  > => {
    const cost = ballCostRef.current;
    const available = balanceRef.current - committedCostRef.current;
    if (available < cost) {
      return { ok: false, reason: "insufficient" };
    }
    committedCostRef.current += cost;
    setCommittedCost(committedCostRef.current);
    return dropAndSettle();
  }, [dropAndSettle]);

  const onBuy = useCallback(async () => {
    if (buyDebounceRef.current || autoInFlightRef.current) return;
    if (!boardRef.current) {
      setLastResult("Board not ready");
      return;
    }
    void unlockSfx();

    const cost = ballCostRef.current;
    const count = clampBallCount(ballCountRef.current);
    const need = cost * count;
    const available = balanceRef.current - committedCostRef.current;
    if (available < need) {
      setLastResult("Insufficient balance");
      return;
    }

    if (ballsInFlightRef.current + count > MAX_CONCURRENT_BALLS) {
      setLastResult(`Too many balls on board (max ${MAX_CONCURRENT_BALLS})`);
      return;
    }

    // Brief debounce — unlocks while balls are still flying.
    buyDebounceRef.current = true;
    setBuyDebouncing(true);
    window.setTimeout(() => {
      buyDebounceRef.current = false;
      setBuyDebouncing(false);
    }, BUY_DEBOUNCE_MS);

    committedCostRef.current += need;
    setCommittedCost(committedCostRef.current);
    setLastResult(count > 1 ? `Dropping ×${count}…` : null);

    const outcomes: Array<{ multiplier: number; balance: number }> = [];
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      if (i > 0) await sleep(SPAWN_STAGGER_MS);
      tasks.push(
        (async () => {
          const outcome = await dropAndSettle();
          if (outcome.ok) {
            outcomes.push({
              multiplier: outcome.multiplier,
              balance: outcome.balance,
            });
            setLastResult(
              count > 1
                ? `×${outcomes.length}/${count} landed; last ${outcome.multiplier}x → bal ${outcome.balance}`
                : `Landed ${outcome.multiplier}x → bal ${outcome.balance}`,
            );
          } else if (outcomes.length === 0 && i === 0) {
            setLastResult(
              outcome.reason === "insufficient"
                ? "Insufficient balance"
                : (outcome.message ?? "Drop failed"),
            );
          }
        })(),
      );
    }

    await Promise.all(tasks);

    if (outcomes.length > 0) {
      const last = outcomes[outcomes.length - 1]!;
      const totalPayoutSense = outcomes.reduce((s, o) => s + o.multiplier, 0);
      setLastResult(
        count > 1
          ? `×${outcomes.length} landed (Σ ${totalPayoutSense.toFixed(1)}x); last ${last.multiplier}x → bal ${last.balance}`
          : `Landed ${last.multiplier}x → bal ${last.balance}`,
      );
    }
  }, [dropAndSettle]);

  const onStopAuto = useCallback(() => {
    stopAutoRef.current = true;
  }, []);

  const onAuto = useCallback(async () => {
    if (autoInFlightRef.current || buyDebounceRef.current) return;
    if (ballsInFlightRef.current > 0) {
      setLastResult("Wait for balls to land before AUTO");
      return;
    }
    if (!boardRef.current) {
      setLastResult("Board not ready");
      return;
    }
    if (balanceRef.current - committedCostRef.current < ballCostRef.current) {
      setLastResult("Insufficient balance");
      return;
    }

    stopAutoRef.current = false;
    autoInFlightRef.current = true;
    setAutoRunning(true);
    void unlockSfx();
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
        if (balanceRef.current - committedCostRef.current < ballCostRef.current) {
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
      autoInFlightRef.current = false;
      setAutoRunning(false);
    }
  }, [runOneDrop]);

  const onAssetChange = useCallback(
    (next: Asset) => {
      if (autoInFlightRef.current || ballsInFlightRef.current > 0) return;
      setAsset(next);
      setLastResult(null);
    },
    [],
  );

  const onRiskChange = useCallback(
    (next: RiskMode) => {
      if (autoInFlightRef.current || ballsInFlightRef.current > 0) return;
      if (next === risk) return;
      stopAutoRef.current = true;
      setBoardReady(false);
      setRisk(next);
      saveStoredRisk(next);
      setLastResult(null);
      streakRef.current = 0;
      setStreak(0);
    },
    [risk],
  );

  const onBallCountChange = useCallback((n: number) => {
    setBallCount(clampBallCount(n));
  }, []);

  const onMuteToggle = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setMuted(next);
      if (!next) {
        void unlockSfx();
      }
      return next;
    });
  }, []);

  const needForBuy = ballCost * ballCount;
  const freeForBuy = balance - committedCost;
  const cannotAfford = freeForBuy < needForBuy;
  const disabled = !hydrated || !boardReady || cannotAfford;

  return (
    <main className="plinko-shell relative mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-3 lg:flex-row lg:items-stretch lg:gap-4 lg:px-5 lg:py-4">
      <JuiceOverlay
        tier={juiceTier}
        label={juiceText}
        streak={streak}
        pulseKey={pulseKey}
      />

      {/* Desktop sidebar / mobile top chrome */}
      <aside className="flex shrink-0 flex-col gap-2 lg:w-[340px] lg:gap-2.5">
        <ShellHeader
          balance={balance}
          asset={asset}
          address={address}
          muted={muted}
          onMuteToggle={onMuteToggle}
          compact
          trailing={
            <AssetToggle asset={asset} onChange={onAssetChange} compact />
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <DemoBanner compact />
          <p className="text-[10px] text-[var(--muted)]">
            {address
              ? asset === "WLD"
                ? "WLD demo · same wallet id"
                : "Wallet demo"
              : asset === "WLD"
                ? "Guest WLD demo"
                : "Guest demo"}
          </p>
        </div>

        {asset === "WLD" ? (
          <p className="hidden text-[10px] text-[var(--muted)] lg:block">
            World App connect coming in v1.1 — demo chips only
          </p>
        ) : null}

        {/* Controls stay under header on desktop; under board on mobile via order */}
        <div className="hidden lg:block">
          <Controls
            ballCost={ballCost}
            onBallCost={setBallCost}
            ballCount={ballCount}
            onBallCount={onBallCountChange}
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
            busy={buyDebouncing}
            autoRunning={autoRunning}
            ballsInFlight={ballsInFlight}
            risk={risk}
            onRisk={onRiskChange}
          />
          {cannotAfford && hydrated ? (
            <p className="mt-1.5 text-center text-[10px] text-[var(--muted)]">
              Insufficient {asset} for {ballCount}×{ballCost}
              {committedCost > 0 ? ` (${committedCost} reserved in flight)` : ""}.
            </p>
          ) : null}
          <p className="mt-2 text-center text-[10px] text-[var(--muted)]">
            <span className="font-semibold text-[var(--brass)]">Demo — not real funds</span>
            {" · "}Onyx Labs
          </p>
        </div>
      </aside>

      {/* Board column — flex-1 slot height is independent of canvas paint */}
      <section className="relative flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="relative min-h-0 w-full flex-1 overflow-hidden">
          <PlinkoBoard
            key={risk}
            apiRef={boardRef}
            onReady={onBoardReady}
            multipliers={multipliers}
            binWeights={binWeights}
          />
          {streak >= 2 ? (
            <div className="pointer-events-none absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
              <p
                className={
                  streak >= 10
                    ? "rounded-full border border-yellow-300/60 bg-yellow-400/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-yellow-100 shadow-[0_0_16px_rgba(250,204,21,0.35)] sm:px-3 sm:py-1 sm:text-xs"
                    : streak >= 5
                      ? "rounded-full border border-amber-300/50 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-100 sm:px-3 sm:py-1 sm:text-xs"
                      : "rounded-full border border-[var(--brass)]/45 bg-[var(--brass)]/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--brass)] sm:px-3 sm:py-1 sm:text-xs"
                }
              >
                連擊 ×{streak}
              </p>
            </div>
          ) : null}
        </div>

        {/* Fixed-height status so result text cannot reflow the board slot */}
        <div className="flex h-6 shrink-0 items-center justify-center overflow-hidden px-1">
          {lastResult ? (
            <p className="w-full truncate rounded-lg border border-[var(--brass)]/20 bg-[var(--brass)]/5 px-2.5 py-0.5 text-center text-[11px] font-medium text-[var(--accent)] sm:text-xs">
              {lastResult}
            </p>
          ) : (
            <p className="w-full truncate text-center text-[10px] text-[var(--muted)] sm:text-[11px]">
              {!boardReady
                ? "Loading board…"
                : asset === "WLD"
                  ? "Tap BUY — WLD chips are demo; World connect in v1.1."
                  : "Tap BUY to drop — demo chips only. Multi-click OK."}
            </p>
          )}
        </div>

        {/* Mobile controls under board */}
        <div className="shrink-0 lg:hidden">
          <Controls
            ballCost={ballCost}
            onBallCost={setBallCost}
            ballCount={ballCount}
            onBallCount={onBallCountChange}
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
            busy={buyDebouncing}
            autoRunning={autoRunning}
            ballsInFlight={ballsInFlight}
            risk={risk}
            onRisk={onRiskChange}
          />
          <p className="mt-1 h-4 text-center text-[10px] text-[var(--muted)]">
            {cannotAfford && hydrated
              ? `Insufficient ${asset} for ${ballCount}×${ballCost}${committedCost > 0 ? ` (${committedCost} reserved in flight)` : ""}.`
              : " "}
          </p>
        </div>
      </section>
    </main>
  );
}
