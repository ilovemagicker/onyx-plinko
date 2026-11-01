/** Fixed demo disclaimer — exact copy required by spec. Compact for one-screen. */
export function DemoBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p
        role="status"
        className="inline-flex items-center rounded-full border border-[var(--brass)]/35 bg-[linear-gradient(90deg,rgba(212,175,118,0.14),rgba(200,245,66,0.1),rgba(212,175,118,0.14))] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--brass)] shadow-[inset_0_0_0_1px_rgba(212,175,118,0.08)]"
      >
        Demo — not real funds
      </p>
    );
  }

  return (
    <p
      role="status"
      className="rounded-xl border border-[var(--accent)]/25 bg-[linear-gradient(90deg,rgba(200,245,66,0.12),rgba(255,183,197,0.08),rgba(200,245,66,0.12))] px-3 py-2.5 text-center text-sm font-semibold tracking-wide text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(200,245,66,0.08)]"
    >
      Demo — not real funds
    </p>
  );
}
