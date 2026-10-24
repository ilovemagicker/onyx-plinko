"use client";

import { ASSETS, type Asset } from "@/lib/assets";

export type AssetToggleProps = {
  asset: Asset;
  onChange: (asset: Asset) => void;
};

export function AssetToggle({ asset, onChange }: AssetToggleProps) {
  return (
    <div
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
      role="group"
      aria-label="Asset"
    >
      {ASSETS.map((a) => {
        const active = a === asset;
        return (
          <button
            key={a}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(a)}
            className={
              active
                ? "rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-[var(--background)] shadow-[0_0_16px_-4px_var(--glow)]"
                : "rounded-full px-3.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            }
          >
            {a}
          </button>
        );
      })}
    </div>
  );
}
