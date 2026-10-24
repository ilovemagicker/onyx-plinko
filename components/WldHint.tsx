/** Soft CTA — World App connect is out of v1. Exact copy from plan Task 9. */
export const WORLD_APP_HINT =
  "World App connect coming in v1.1 — demo chips only";

/**
 * Shown when the WLD asset is selected. Demo chips still use the same
 * connected address (or guest) as SOL for storage identity — two balances,
 * one identity. No World wallet in v1.
 */
export function WldHint() {
  return (
    <p
      role="status"
      className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-xs text-[var(--muted)]"
    >
      {WORLD_APP_HINT}
    </p>
  );
}
