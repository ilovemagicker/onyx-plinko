export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Onyx Labs
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Plinko</h1>
        </div>
      </header>

      <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-sm text-[var(--accent)]">
        Demo — not real funds
      </p>

      <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm text-[var(--muted)]">
          Board and wallet shell come in later tasks.
        </p>
      </section>
    </main>
  );
}
