"use client";

import { ASSETS, type Asset } from "@/lib/assets";

export type AssetToggleProps = {
  asset: Asset;
  onChange: (asset: Asset) => void;
  compact?: boolean;
};

export function AssetToggle({ asset, onChange, compact = false }: AssetToggleProps) {
  return (
    <div
      className={
        compact
          ? "inline-flex rounded-full border-2 border-white/90 bg-white/80 p-0.5 shadow-md"
          : "inline-flex rounded-full border-2 border-white/90 bg-white/80 p-1 shadow-md"
      }
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
                ? compact
                  ? "rounded-full bg-gradient-to-b from-[#ffe566] to-[#ffc933] px-2.5 py-1 text-[10px] font-extrabold text-[#5a3a00] shadow"
                  : "rounded-full bg-gradient-to-b from-[#ffe566] to-[#ffc933] px-3.5 py-1.5 text-xs font-extrabold text-[#5a3a00] shadow"
                : compact
                  ? "rounded-full px-2.5 py-1 text-[10px] font-bold text-[#3d5a8a] transition hover:text-[#1a2550]"
                  : "rounded-full px-3.5 py-1.5 text-xs font-bold text-[#3d5a8a] transition hover:text-[#1a2550]"
            }
          >
            {a}
          </button>
        );
      })}
    </div>
  );
}
