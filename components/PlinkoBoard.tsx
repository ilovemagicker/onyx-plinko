"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { PlinkoBoardHandle, PlinkoGameApi } from "@/game/types";

export type { PlinkoBoardHandle };

export type PlinkoBoardProps = {
  className?: string;
  /**
   * Filled when Phaser is ready. Prefer this over forwardRef —
   * next/dynamic does not forward refs reliably.
   */
  apiRef?: MutableRefObject<PlinkoBoardHandle | null>;
  /** Called once the Phaser scene is ready for dropBall. */
  onReady?: () => void;
};

/**
 * Client-only Phaser Plinko board.
 * Parent should load this via next/dynamic `{ ssr: false }`.
 */
export default function PlinkoBoard({
  className,
  apiRef,
  onReady,
}: PlinkoBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const localApiRef = useRef<PlinkoGameApi | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let api: PlinkoGameApi | null = null;

    async function boot() {
      if (typeof window === "undefined") return;
      if (!containerRef.current) return;

      try {
        const { createPlinkoGame } = await import("@/game/createPlinkoScene");
        if (cancelled || !containerRef.current) return;
        api = await createPlinkoGame(containerRef.current);
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
    // Mount-once boot; apiRef/onReady are stable enough for Task 7/8.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={
        className ??
        "relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_0_0_1px_rgba(200,245,66,0.08),0_0_40px_-8px_rgba(200,245,66,0.25),0_0_80px_-20px_rgba(255,183,197,0.2)]"
      }
    >
      {/* Soft sakura / ink wash behind canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_8%,rgba(255,183,197,0.22),transparent_48%),radial-gradient(ellipse_at_88%_28%,rgba(255,143,171,0.14),transparent_42%),radial-gradient(ellipse_at_50%_70%,rgba(200,245,66,0.06),transparent_55%),linear-gradient(180deg,#1c1224_0%,#0c0c12_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent"
      />
      <div
        id="plinko-root"
        ref={containerRef}
        className="relative mx-auto aspect-[360/520] w-full max-w-[360px]"
      />
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
