/** Fixed demo disclaimer — exact copy required by spec. */
export function DemoBanner() {
  return (
    <p
      role="status"
      className="rounded-xl border border-[var(--accent)]/25 bg-[linear-gradient(90deg,rgba(200,245,66,0.12),rgba(255,183,197,0.08),rgba(200,245,66,0.12))] px-3 py-2.5 text-center text-sm font-semibold tracking-wide text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(200,245,66,0.08)]"
    >
      Demo — not real funds
    </p>
  );
}
