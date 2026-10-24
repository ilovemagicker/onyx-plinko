"use client";

import { ASSETS, type Asset } from "@/lib/assets";

export type AssetToggleProps = {
  asset: Asset;
  onChange: (asset: Asset) => void;
};

export function AssetToggle({ asset, onChange }: AssetToggleProps) {
  return (
    <div
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
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
                ? "rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--background)]"
                : "rounded-full px-3 py-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
            }
          >
            {a}
          </button>
        );
      })}
    </div>
  );
}
