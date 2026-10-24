/** Fixed demo disclaimer — exact copy required by spec. */
export function DemoBanner() {
  return (
    <p
      role="status"
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-medium text-[var(--accent)]"
    >
      Demo — not real funds
    </p>
  );
}
