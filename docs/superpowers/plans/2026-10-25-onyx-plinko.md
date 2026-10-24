# Onyx Plinko v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first Next.js Plinko demo at `plinko.onyxlab.dev` with Onyx shell, Japanese-style Phaser board, WLD|SOL chip toggles, Solana Wallet Adapter, guest + per-address demo balances, and no real-fund transfers.

**Architecture:** Next.js App Router (Vercel) hosts the Onyx chrome and wallet UI; Phaser runs the peg board in a client-only component; a pure TypeScript demo ledger owns debit/credit rules and persists to `localStorage` keyed by `(address|guest, asset)`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Vitest, `@solana/wallet-adapter-react` + Phantom, Phaser 3, Vercel.

## Global Constraints

- Demo only: never transfer WLD or SOL on-chain in v1; UI must show **Demo — not real funds**.
- Brand: Onyx Labs; proposed domain `plinko.onyxlab.dev`; working name Plinko.
- Shell: dark minimal Onyx; board: Japanese-inspired art layer allowed.
- Assets in UI: both **WLD** and **SOL**; SOL connect via Wallet Adapter; WLD connect best-effort / placeholder OK.
- Guest play allowed; connected balances persist per browser.
- No custody, no house bank, no World App mini-app packaging in v1.
- Spec: `docs/superpowers/specs/2026-10-25-onyx-plinko-design.md`.

## File map (create)

```
onyx-plinko/
  package.json
  tsconfig.json
  next.config.ts
  vitest.config.ts
  app/layout.tsx
  app/page.tsx
  app/globals.css
  app/providers.tsx
  components/ShellHeader.tsx
  components/Controls.tsx
  components/AssetToggle.tsx
  components/DemoBanner.tsx
  components/PlinkoBoard.tsx          # client; mounts Phaser
  lib/assets.ts                       # WLD | SOL
  lib/multipliers.ts                  # bin multipliers config
  lib/ledger.ts                       # pure demo ledger
  lib/ledger-storage.ts               # localStorage adapter
  lib/ball-cost.ts
  game/createPlinkoScene.ts           # Phaser scene factory
  game/types.ts
  __tests__/ledger.test.ts
  __tests__/multipliers.test.ts
  __tests__/ball-cost.test.ts
  public/og.png                       # optional later
```

---

### Task 1: Scaffold Next.js app + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: none
- Produces: runnable `npm run dev` / `npm test`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "onyx-plinko",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.5.7",
    "phaser": "^3.87.0",
    "react": "19.1.1",
    "react-dom": "19.1.1",
    "@solana/wallet-adapter-base": "^0.9.23",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-react-ui": "^0.9.35",
    "@solana/wallet-adapter-wallets": "^0.19.32",
    "@solana/web3.js": "^1.98.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.5.4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Minimal `app/page.tsx` + dark `globals.css` + `layout.tsx` with title `Plinko · Onyx Labs`**

- [ ] **Step 4: Install and verify**

Run: `npm install && npm test && npm run build`  
Expected: install OK; vitest “No test files” or 0 tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts app
git commit -m "chore: scaffold Next.js Plinko app with Vitest"
```

---

### Task 2: Demo ledger (pure logic)

**Files:**
- Create: `lib/assets.ts`, `lib/ledger.ts`, `__tests__/ledger.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `export type Asset = "WLD" | "SOL"`
  - `export type LedgerKey = { address: string | null; asset: Asset }` // null address = guest
  - `export function applyDrop(balance: number, ballCost: number, multiplier: number): { ok: true; balance: number } | { ok: false; reason: "insufficient" }`
  - `export function creditGuestStart(balance?: number): number` // default 1000

- [ ] **Step 1: Write failing tests** in `__tests__/ledger.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { applyDrop, creditGuestStart } from "@/lib/ledger";

describe("applyDrop", () => {
  it("rejects when balance < ballCost", () => {
    expect(applyDrop(5, 10, 2)).toEqual({ ok: false, reason: "insufficient" });
  });

  it("debits cost then credits cost * multiplier", () => {
    // start 100, cost 10, land 2x → 100 - 10 + 20 = 110
    expect(applyDrop(100, 10, 2)).toEqual({ ok: true, balance: 110 });
  });

  it("supports 0.5x", () => {
    expect(applyDrop(100, 10, 0.5)).toEqual({ ok: true, balance: 95 });
  });
});

describe("creditGuestStart", () => {
  it("defaults to 1000", () => {
    expect(creditGuestStart()).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- __tests__/ledger.test.ts`  
Expected: FAIL module not found / export missing.

- [ ] **Step 3: Implement `lib/assets.ts` + `lib/ledger.ts`**

```ts
// lib/assets.ts
export type Asset = "WLD" | "SOL";
export const ASSETS: Asset[] = ["WLD", "SOL"];

// lib/ledger.ts
export function applyDrop(
  balance: number,
  ballCost: number,
  multiplier: number,
): { ok: true; balance: number } | { ok: false; reason: "insufficient" } {
  if (balance < ballCost) return { ok: false, reason: "insufficient" };
  const next = balance - ballCost + ballCost * multiplier;
  return { ok: true, balance: Number(next.toFixed(8)) };
}

export function creditGuestStart(balance = 1000): number {
  return balance;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- __tests__/ledger.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/assets.ts lib/ledger.ts __tests__/ledger.test.ts
git commit -m "feat: pure demo ledger applyDrop"
```

---

### Task 3: Multipliers + ball cost config

**Files:**
- Create: `lib/multipliers.ts`, `lib/ball-cost.ts`, `__tests__/multipliers.test.ts`, `__tests__/ball-cost.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `export const DEFAULT_MULTIPLIERS: number[]` // length 17 odd, edges high (e.g. 100 … 0.5 … 100)
  - `export function binIndexForNormalizedX(x: number, binCount: number): number` // x in [0,1]
  - `export const BALL_COSTS: number[]` // e.g. [1, 5, 10, 25]
  - `export const DEFAULT_BALL_COST = 10`

- [ ] **Step 1: Failing tests** for bin mapping and multipliers length odd ≥ 9

- [ ] **Step 2: Implement configs** matching reference-style edges-high table (exact array in code; document in comment)

Example multipliers (17 bins):

```ts
export const DEFAULT_MULTIPLIERS = [
  100, 15, 6, 3, 1.4, 0.7, 0.5, 0.3, 0.5, 0.3, 0.5, 0.7, 1.4, 3, 6, 15, 100,
];
```

`binIndexForNormalizedX`: `Math.min(binCount - 1, Math.max(0, Math.floor(x * binCount)))`

- [ ] **Step 3: Tests PASS + commit** `feat: plinko multipliers and ball costs`

---

### Task 4: localStorage ledger adapter

**Files:**
- Create: `lib/ledger-storage.ts`, `__tests__/ledger-storage.test.ts` (use vitest with memory mock)

**Interfaces:**
- Consumes: `Asset` from `lib/assets.ts`
- Produces:
  - `storageKey(address: string | null, asset: Asset): string` → `onyx-plinko:v1:${address ?? "guest"}:${asset}`
  - `loadBalance(address, asset, fallback): number`
  - `saveBalance(address, asset, balance): void`

- [ ] **Step 1–4:** TDD with in-memory `Storage` mock; commit `feat: demo balance localStorage adapter`

---

### Task 5: Demo banner + asset toggle + shell header (no wallet yet)

**Files:**
- Create: `components/DemoBanner.tsx`, `components/AssetToggle.tsx`, `components/ShellHeader.tsx`, `components/Controls.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `Asset`, `ASSETS`, `loadBalance` / `saveBalance`, `DEFAULT_BALL_COST`, `BALL_COSTS`
- Produces: controlled UI props:
  - `AssetToggle({ asset, onChange })`
  - `ShellHeader({ balance, asset, onConnectClick? })`
  - `Controls({ ballCost, onBallCost, onBuy, onAuto, speed, onSpeed, disabled })`

- [ ] **Step 1:** Wire page state: `asset`, `balance` from guest storage, banner text exactly `Demo — not real funds`

- [ ] **Step 2:** BUY button calls `applyDrop` with multiplier `1` stub (until Phaser) **or** disable BUY until Task 7 — prefer enable with stub land multiplier random from `DEFAULT_MULTIPLIERS` for interim playtest

- [ ] **Step 3:** Visual: dark background `#0B0B0F`, accent close to Vault lime `#C8F542` for primary CTA

- [ ] **Step 4:** Manual check `npm run dev` — toggle WLD/SOL switches stored balances

- [ ] **Step 5: Commit** `feat: Onyx shell, asset toggle, demo banner`

---

### Task 6: Solana Wallet Adapter provider

**Files:**
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`, `components/ShellHeader.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: wallet-adapter packages
- Produces: `WalletProvider` + `ConnectionProvider` (mainnet-beta RPC public endpoint OK for address-only v1); header shows truncated address; on connect, `address = publicKey.toBase58()` and reload balance for current asset

- [ ] **Step 1:** `providers.tsx` with `PhantomWalletAdapter` only (keep wallet list small)

- [ ] **Step 2:** On `publicKey` change, `loadBalance(address, asset, creditGuestStart())`

- [ ] **Step 3:** Disconnect → `address = null` (guest key)

- [ ] **Step 4:** Manual: connect Phantom in browser (or wallet-adapter UI)

- [ ] **Step 5: Commit** `feat: Solana Wallet Adapter connect for demo identity`

---

### Task 7: Phaser Plinko board

**Files:**
- Create: `game/types.ts`, `game/createPlinkoScene.ts`, `components/PlinkoBoard.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `DEFAULT_MULTIPLIERS`
- Produces: `PlinkoBoard` client component with imperative handle:

```ts
export type PlinkoBoardHandle = {
  dropBall: (seed?: string) => Promise<{ binIndex: number; multiplier: number }>;
  setSpeed: (speed: number) => void; // 1 | 1.5 | 2 | 3 | 5
};
```

Implementation notes:
- `dynamic(() => import(...), { ssr: false })` for Phaser
- Scene: static peg grid, walls, sensor bins at bottom; ball Matter or Arcade physics
- Resolve promise when ball overlaps a bin
- Japanese art: CSS/background image behind canvas (placeholder gradient OK in v1; swap asset later)
- `setSpeed` scales time / velocity; does not change bin math

- [ ] **Step 1:** Mount empty Phaser game in `#plinko-root`  without crashing

- [ ] **Step 2:** Pegs + bins visible; one ball drop resolves multiplier

- [ ] **Step 3:** Wire `setSpeed`

- [ ] **Step 4: Commit** `feat: Phaser plinko board with dropBall API`

---

### Task 8: Wire BUY / AUTO to ledger + board

**Files:**
- Modify: `app/page.tsx`, `components/Controls.tsx`

**Interfaces:**
- Consumes: `applyDrop`, `saveBalance`, `PlinkoBoardHandle.dropBall`

Flow for single buy:
1. If `applyDrop` would fail on **worst** case — actually check `balance >= ballCost` first
2. Optimistically keep UI disabled while dropping
3. `const { multiplier } = await board.dropBall()`
4. `const result = applyDrop(balance, ballCost, multiplier)`; if ok, set + save

AUTO: loop N times (e.g. 10) with same cost; stop on insufficient or Stop click.

- [ ] **Step 1:** Single BUY end-to-end

- [ ] **Step 2:** AUTO with cancel

- [ ] **Step 3:** Ensure no double-debit (disable BUY while in flight)

- [ ] **Step 4: Commit** `feat: buy and auto wired to ledger and Phaser`

---

### Task 9: WLD path + empty-state copy

**Files:**
- Modify: `components/ShellHeader.tsx`, `app/page.tsx`, maybe `components/WldHint.tsx`

**Interfaces:**
- When `asset === "WLD"` and no World wallet: still use guest or SOL-connected address as **storage identity only** (document in UI: “WLD chips are demo; World connect in v1.1”), OR keep separate guest WLD bucket when only Phantom connected — **choose: use same connected address string for both assets’ storage keys** so one wallet identity, two balances.

- [ ] **Step 1:** Implement same-address dual balances

- [ ] **Step 2:** Soft hint when WLD selected: `World App connect coming in v1.1 — demo chips only`

- [ ] **Step 3: Commit** `feat: WLD demo ledger + World App hint`

---

### Task 10: SEO, disclaimer footer, acceptance polish

**Files:**
- Modify: `app/layout.tsx` metadata, `app/page.tsx` footer
- Create: `public/robots.txt`, `app/sitemap.ts` (optional simple)

**Acceptance checklist (manual):**
1. Mobile width board + shell
2. Guest BUY works
3. Phantom connect persists SOL balance
4. WLD toggle separate balance
5. AUTO / SPEED OK
6. Visible Demo banner
7. No chain sendTransaction calls anywhere (grep)

- [ ] **Step 1:** Metadata title/description include demo disclaimer

- [ ] **Step 2:** `rg -n "sendTransaction|signTransaction" .` → no matches (except possibly unused wallet adapter internals — app code must not call)

- [ ] **Step 3:** `npm test && npm run build`

- [ ] **Step 4: Commit** `feat: SEO and v1 acceptance polish`

---

### Task 11: GitHub + Vercel domain (ops)

**Files:** none required in app beyond env example

- [ ] **Step 1:** Create GitHub repo `ilovemagicker/onyx-plinko`, push `main`

- [ ] **Step 2:** Vercel project + DNS `plinko.onyxlab.dev`

- [ ] **Step 3:** Smoke on production URL

- [ ] **Step 4:** Note URL in README

```bash
git commit -m "docs: README with production URL" 
```

---

## Spec coverage self-check

| Spec item | Task |
| --- | --- |
| Hybrid demo chips | 2, 4, 8 |
| Web first / Next.js | 1, 11 |
| WLD + SOL UI | 5, 9 |
| JP board + Onyx shell | 5, 7 |
| Phaser/Pixi board | 7 (Phaser) |
| Wallet Adapter | 6 |
| Guest + connected storage | 4, 5, 6 |
| BUY / AUTO / SPEED | 7, 8 |
| Demo disclaimer | 5, 10 |
| No real transfers | 10 grep |
| World App later | 9 hint only |
| Domain plinko.onyxlab.dev | 11 |

## Placeholder scan

None intentional. Multiplier table is concrete. Phaser art may use gradient placeholder until assets exist — allowed.

