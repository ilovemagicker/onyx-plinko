"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import type { PlinkoBoardHandle, PlinkoGameApi } from "@/game/types";
import {
  BOARD_LOGIC_H,
  BOARD_LOGIC_W,
  boardSizeChanged,
  fitBoardStage,
} from "@/lib/board-fit";
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";
import { DEMO_BIN_WEIGHTS } from "@/lib/bin-odds";

export type { PlinkoBoardHandle };
export { BOARD_LOGIC_H, BOARD_LOGIC_W } from "@/lib/board-fit";

/** Ignore sub-pixel / chrome jitter below this many CSS pixels. */
const SIZE_EPSILON_PX = 2;

export type PlinkoBoardProps = {
  className?: string;
  /**
   * Filled when Phaser is ready. Prefer this over forwardRef —
   * next/dynamic does not forward refs reliably.
   */
  apiRef?: MutableRefObject<PlinkoBoardHandle | null>;
  /** Called once the Phaser scene is ready for dropBall. */
  onReady?: () => void;
  /** Payout table for bin labels + settlement (risk mode). */
  multipliers?: number[];
  /** Settlement weights matching multipliers length. */
  binWeights?: number[];
};

/**
 * Client-only Phaser Plinko board.
 * Parent should load this via next/dynamic `{ ssr: false }`.
 * Remount (change `key`) when risk multipliers change.
 *
 * Size stability: measure the flex slot with ResizeObserver, write explicit
 * px onto an aspect-locked stage (epsilon-gated), and keep the Phaser parent
 * absolute-inset so the canvas never feeds back into layout.
 */
export default function PlinkoBoard({
  className,
  apiRef,
  onReady,
  multipliers = DEFAULT_MULTIPLIERS,
  binWeights = DEMO_BIN_WEIGHTS,
}: PlinkoBoardProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const localApiRef = useRef<PlinkoGameApi | null>(null);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  const [stagePx, setStagePx] = useState({ w: 0, h: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot || typeof ResizeObserver === "undefined") return;

    let raf = 0;
    const apply = (cw: number, ch: number) => {
      const next = fitBoardStage(cw, ch);
      const prev = lastSizeRef.current;
      if (!boardSizeChanged(prev, next, SIZE_EPSILON_PX)) return;
      lastSizeRef.current = next;
      setStagePx(next);
    };

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const cr = entry.contentRect;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => apply(cr.width, cr.height));
    });
    ro.observe(slot);
    // Initial measure (before first RO fire in some browsers)
    apply(slot.clientWidth, slot.clientHeight);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let api: PlinkoGameApi | null = null;

    async function boot() {
      if (typeof window === "undefined") return;
      if (!containerRef.current) return;

      try {
        const { createPlinkoGame } = await import("@/game/createPlinkoScene");
        if (cancelled || !containerRef.current) return;
        api = await createPlinkoGame(containerRef.current, {
          multipliers,
          binWeights,
        });
        if (cancelled) {
          api.destroy();
          return;
        }
        localApiRef.current = api;
        if (apiRef) {
          apiRef.current = {
            dropBall: (seed?: string) => api!.dropBall(seed),
            setSpeed: (speed: number) => api!.setSpeed(speed),
          };
        }
        setStatus("ready");
        onReady?.();
      } catch (err) {
        console.error("Plinko board failed to boot", err);
        if (!cancelled) setStatus("error");
      }
    }

    void boot();

    return () => {
      cancelled = true;
      localApiRef.current = null;
      if (apiRef) apiRef.current = null;
      api?.destroy();
    };
    // Remount when parent changes key / multipliers — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageStyle: CSSProperties =
    stagePx.w > 0 && stagePx.h > 0
      ? {
          width: `${stagePx.w}px`,
          height: `${stagePx.h}px`,
        }
      : {
          // Pre-measure fallback: still aspect-locked, won't expand parent
          width: "100%",
          maxWidth: "100%",
          aspectRatio: `${BOARD_LOGIC_W} / ${BOARD_LOGIC_H}`,
          maxHeight: "100%",
          height: "auto",
        };

  return (
    <div
      ref={slotRef}
      className={
        className ??
        "plinko-board-frame relative h-full w-full overflow-hidden rounded-2xl"
      }
    >
      {/* Soft lacquer wash behind canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_8%,rgba(212,175,118,0.16),transparent_42%),radial-gradient(ellipse_at_18%_30%,rgba(255,183,197,0.08),transparent_40%),radial-gradient(ellipse_at_85%_40%,rgba(200,245,66,0.05),transparent_38%),linear-gradient(180deg,#1a1216_0%,#0a080e_78%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brass)]/50 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-transparent via-[var(--brass)]/25 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-3 right-0 w-px bg-gradient-to-b from-transparent via-[var(--brass)]/25 to-transparent"
      />

      <div
        className="plinko-board-stage absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
        style={stageStyle}
      >
        <div
          id="plinko-root"
          ref={containerRef}
          className="absolute inset-0 h-full w-full overflow-hidden"
        />
      </div>

      {status === "loading" ? (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-[var(--muted)]">
          Loading board…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-red-400">
          Board failed to load
        </p>
      ) : null}
    </div>
  );
}
