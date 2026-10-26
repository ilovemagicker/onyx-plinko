import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PEG_HIT_MIN_INTERVAL_MS,
  SFX_MUTE_KEY,
  __resetSfxForTests,
  __setSfxStorageForTests,
  initSfxMuteFromStorage,
  isMuted,
  loadMuted,
  playBigWin,
  playBinLand,
  playDrop,
  playLandForMultiplier,
  playPegHit,
  playStreak,
  saveMuted,
  setMuted,
} from "@/lib/sfx";

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

describe("sfx mute persistence", () => {
  beforeEach(() => {
    __resetSfxForTests();
    __setSfxStorageForTests(createMemoryStorage());
  });

  afterEach(() => {
    __resetSfxForTests();
  });

  it("defaults unmuted when storage empty", () => {
    expect(loadMuted()).toBe(false);
    expect(initSfxMuteFromStorage()).toBe(false);
    expect(isMuted()).toBe(false);
  });

  it("persists mute flag across re-init", () => {
    const storage = createMemoryStorage();
    __setSfxStorageForTests(storage);
    saveMuted(true);
    expect(storage.getItem(SFX_MUTE_KEY)).toBe("1");
    expect(loadMuted()).toBe(true);

    // Simulate fresh page load with same storage
    __resetSfxForTests();
    __setSfxStorageForTests(storage);
    expect(initSfxMuteFromStorage()).toBe(true);
    expect(isMuted()).toBe(true);
  });

  it("setMuted writes storage", () => {
    const storage = createMemoryStorage();
    __setSfxStorageForTests(storage);
    setMuted(true);
    expect(storage.getItem(SFX_MUTE_KEY)).toBe("1");
    setMuted(false);
    expect(storage.getItem(SFX_MUTE_KEY)).toBe("0");
    expect(isMuted()).toBe(false);
  });

  it("returns fallback when storage unavailable", () => {
    __setSfxStorageForTests(null);
    expect(loadMuted(true)).toBe(true);
    expect(loadMuted(false)).toBe(false);
    saveMuted(true); // no-op
  });
});

describe("sfx play helpers (no AudioContext in node)", () => {
  beforeEach(() => {
    __resetSfxForTests();
    __setSfxStorageForTests(createMemoryStorage());
    initSfxMuteFromStorage();
  });

  afterEach(() => {
    __resetSfxForTests();
  });

  it("play* helpers are safe no-ops without unlocked audio", () => {
    expect(() => playDrop()).not.toThrow();
    expect(() => playPegHit()).not.toThrow();
    expect(() => playBinLand(2)).not.toThrow();
    expect(() => playBigWin("jackpot")).not.toThrow();
    expect(() => playBigWin("none")).not.toThrow();
    expect(() => playStreak(3)).not.toThrow();
    expect(() => playLandForMultiplier(100)).not.toThrow();
    expect(() => playLandForMultiplier(8)).not.toThrow();
  });

  it("throttles peg hits by PEG_HIT_MIN_INTERVAL_MS", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    playPegHit();
    now += PEG_HIT_MIN_INTERVAL_MS - 1;
    playPegHit(); // should be ignored by throttle
    now += 2;
    playPegHit(); // allowed again

    expect(performance.now()).toBe(now);
    vi.restoreAllMocks();
  });
});
