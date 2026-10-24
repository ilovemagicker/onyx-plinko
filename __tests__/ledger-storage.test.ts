import { beforeEach, describe, expect, it } from "vitest";
import {
  loadBalance,
  saveBalance,
  storageKey,
} from "@/lib/ledger-storage";

/** Minimal in-memory Storage for node Vitest (no real localStorage). */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe("storageKey", () => {
  it("uses guest when address is null", () => {
    expect(storageKey(null, "WLD")).toBe("onyx-plinko:v1:guest:WLD");
  });

  it("includes address and asset", () => {
    expect(storageKey("Abc123", "SOL")).toBe("onyx-plinko:v1:Abc123:SOL");
  });
});

describe("loadBalance / saveBalance", () => {
  beforeEach(() => {
    // Inject memory Storage as global localStorage for each test
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  it("returns fallback when nothing stored", () => {
    expect(loadBalance(null, "WLD", 1000)).toBe(1000);
  });

  it("round-trips guest balance", () => {
    saveBalance(null, "WLD", 42);
    expect(loadBalance(null, "WLD", 1000)).toBe(42);
  });

  it("keeps WLD and SOL balances separate", () => {
    saveBalance("addr1", "WLD", 10);
    saveBalance("addr1", "SOL", 20);
    expect(loadBalance("addr1", "WLD", 0)).toBe(10);
    expect(loadBalance("addr1", "SOL", 0)).toBe(20);
  });

  it("keeps guest and connected address separate", () => {
    saveBalance(null, "SOL", 5);
    saveBalance("wallet", "SOL", 99);
    expect(loadBalance(null, "SOL", 0)).toBe(5);
    expect(loadBalance("wallet", "SOL", 0)).toBe(99);
  });

  it("returns fallback for invalid stored value", () => {
    localStorage.setItem(storageKey(null, "WLD"), "not-a-number");
    expect(loadBalance(null, "WLD", 1000)).toBe(1000);
  });
});
