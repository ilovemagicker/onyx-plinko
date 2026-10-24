import type { Asset } from "./assets";

export function storageKey(address: string | null, asset: Asset): string {
  return `onyx-plinko:v1:${address ?? "guest"}:${asset}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function loadBalance(
  address: string | null,
  asset: Asset,
  fallback: number,
): number {
  const storage = getStorage();
  if (!storage) return fallback;
  const raw = storage.getItem(storageKey(address, asset));
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function saveBalance(
  address: string | null,
  asset: Asset,
  balance: number,
): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(storageKey(address, asset), String(balance));
}
