/** Fixed demo disclaimer — exact copy required by spec. Compact for one-screen. */
export function DemoBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p
        role="status"
        className="inline-flex items-center rounded-full border-2 border-white/90 bg-gradient-to-r from-[#ffe566] via-[#fff3a8] to-[#7dff6a] px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide text-[#3a2a00] shadow-md"
      >
        Demo — not real funds
      </p>
    );
  }

  return (
    <p
      role="status"
      className="rounded-2xl border-2 border-white/90 bg-gradient-to-r from-[#ffe566] via-[#fff3a8] to-[#7dff6a] px-3 py-2.5 text-center text-sm font-extrabold tracking-wide text-[#3a2a00] shadow-md"
    >
      Demo — not real funds
    </p>
  );
}
