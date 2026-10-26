/**
 * Procedural Plinko SFX via Web Audio API (no asset downloads).
 * Mute preference persists in localStorage. Audio unlocks after a user gesture.
 */

import {
  juiceTierForMultiplier,
  type JuiceTier,
} from "@/lib/juice";

export const SFX_MUTE_KEY = "onyx-plinko:v1:muted";

/** Max peg-hit rate across all balls (~20/sec). */
export const PEG_HIT_MIN_INTERVAL_MS = 50;

type AudioContextLike = {
  state: string;
  currentTime: number;
  destination: AudioNode;
  resume: () => Promise<void>;
  createOscillator: () => OscillatorNode;
  createGain: () => GainNode;
};

let ctx: AudioContextLike | null = null;
let muted = false;
let unlocked = false;
let lastPegHitAt = 0;
/** In-memory override for tests (null = use real localStorage). */
let storageOverride: Storage | null | undefined = undefined;

function getStorage(): Storage | null {
  if (storageOverride !== undefined) return storageOverride;
  try {
    if (typeof globalThis === "undefined") return null;
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

/** Test-only: inject Storage or null; pass `undefined` to restore default. */
export function __setSfxStorageForTests(storage: Storage | null | undefined): void {
  storageOverride = storage;
}

/** Test-only: reset runtime audio state between cases. */
export function __resetSfxForTests(): void {
  ctx = null;
  muted = false;
  unlocked = false;
  lastPegHitAt = 0;
  storageOverride = undefined;
}

export function loadMuted(fallback = false): boolean {
  const storage = getStorage();
  if (!storage) return fallback;
  const raw = storage.getItem(SFX_MUTE_KEY);
  if (raw === null) return fallback;
  return raw === "1" || raw === "true";
}

export function saveMuted(value: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SFX_MUTE_KEY, value ? "1" : "0");
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  saveMuted(value);
  if (!value) {
    void unlock();
  }
}

/** Hydrate mute flag from storage (call once on client mount). */
export function initSfxMuteFromStorage(): boolean {
  muted = loadMuted(false);
  return muted;
}

function ensureContext(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  ctx = new AC() as unknown as AudioContextLike;
  return ctx;
}

/** Resume AudioContext after a user gesture (BUY / mute / tap). */
export async function unlock(): Promise<void> {
  const audio = ensureContext();
  if (!audio) return;
  // Mark intent immediately so the same click's first spawn can play.
  unlocked = true;
  try {
    if (audio.state === "suspended") {
      await audio.resume();
    }
  } catch {
    // Autoplay policy / missing gesture — retry on next interaction.
  }
}

function canPlay(): boolean {
  if (muted || !unlocked) return false;
  const audio = ensureContext();
  if (!audio) return false;
  if (audio.state === "suspended") {
    void audio.resume().catch(() => undefined);
  }
  return true;
}

function tone(
  freq: number,
  durationSec: number,
  opts: {
    type?: OscillatorType;
    gain?: number;
    attack?: number;
    slideTo?: number;
  } = {},
): void {
  const audio = ensureContext();
  if (!audio || !canPlay()) return;

  const type = opts.type ?? "sine";
  const gainLevel = opts.gain ?? 0.08;
  const attack = opts.attack ?? 0.005;
  const now = audio.currentTime;

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (opts.slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.slideTo),
      now + durationSec,
    );
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainLevel, now + attack);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + Math.max(attack + 0.01, durationSec),
  );

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

/** Soft whoosh / blip when a ball spawns. */
export function playDrop(): void {
  if (!canPlay()) return;
  tone(420, 0.07, { type: "triangle", gain: 0.05, slideTo: 280 });
  tone(660, 0.04, { type: "sine", gain: 0.03, attack: 0.002 });
}

/** Short click on peg bounce — globally throttled for multi-ball. */
export function playPegHit(): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastPegHitAt < PEG_HIT_MIN_INTERVAL_MS) return;
  lastPegHitAt = now;
  if (!canPlay()) return;
  const freq = 880 + Math.random() * 420;
  tone(freq, 0.025, { type: "square", gain: 0.028, attack: 0.001 });
}

/** Landing chirp; pitch scales mildly with multiplier. */
export function playBinLand(multiplier: number): void {
  if (!canPlay()) return;
  const m = Number.isFinite(multiplier) ? multiplier : 1;
  const base = 320 + Math.min(800, Math.max(0, m) * 28);
  tone(base, 0.09, { type: "triangle", gain: 0.07, slideTo: base * 1.35 });
  tone(base * 1.5, 0.06, { type: "sine", gain: 0.04, attack: 0.002 });
}

/** Stronger sting for big / jackpot (and optional explicit tier). */
export function playBigWin(tier: JuiceTier | "big" | "jackpot" = "big"): void {
  if (tier === "none" || tier === "nice") return;
  if (!canPlay()) return;

  if (tier === "jackpot") {
    tone(523.25, 0.12, { type: "sine", gain: 0.1 });
    tone(659.25, 0.14, { type: "sine", gain: 0.09, attack: 0.02 });
    tone(783.99, 0.18, { type: "triangle", gain: 0.1, attack: 0.04 });
    tone(1046.5, 0.22, { type: "sine", gain: 0.08, attack: 0.06 });
    return;
  }

  // big
  tone(440, 0.1, { type: "triangle", gain: 0.09 });
  tone(554.37, 0.12, { type: "sine", gain: 0.08, attack: 0.03 });
  tone(659.25, 0.14, { type: "triangle", gain: 0.07, attack: 0.05 });
}

/** Optional streak milestone sparkle. */
export function playStreak(streak: number): void {
  if (!canPlay()) return;
  if (streak !== 3 && streak !== 5 && streak !== 10) return;
  const base = streak >= 10 ? 720 : streak >= 5 ? 600 : 520;
  tone(base, 0.08, { type: "sine", gain: 0.05, slideTo: base * 1.4 });
}

/** Convenience: bin land + big-win sting from multiplier. */
export function playLandForMultiplier(multiplier: number): void {
  playBinLand(multiplier);
  const tier = juiceTierForMultiplier(multiplier);
  if (tier === "big" || tier === "jackpot") {
    playBigWin(tier);
  } else if (multiplier >= 8) {
    // Mid-high bins get a lighter fanfare without full juice overlay.
    if (!canPlay()) return;
    tone(480, 0.08, { type: "triangle", gain: 0.06, slideTo: 640 });
  }
}

/** Whether AudioContext has been resumed after a gesture. */
export function isUnlocked(): boolean {
  return unlocked;
}
