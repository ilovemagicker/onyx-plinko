# Onyx Plinko v1 — Design Spec

**Date:** 2026-10-25 (Asia/Hong_Kong)  
**Brand:** Onyx Labs · onyxlab.dev  
**Product (working name):** Plinko  
**Domain (proposed):** https://plinko.onyxlab.dev  
**Status:** Design approved by 老闆 (brainstorming complete)

## Goal

Ship a **wallet-connect Plinko web game** where users play with **demo chips** labeled as **WLD** or **SOL**. Visual board can be Japanese-inspired (kimono / sakura) while the chrome matches Onyx Labs (dark, minimal, like Swap / Vault). Real-money settlement is **out of v1** but the UI and wallet hooks are shaped so v1.1 can add on-chain stakes later. World App mini-app is a later surface after the web v1.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Money model | **Hybrid** — v1 demo chips; real WLD/SOL stakes later |
| Primary surface | **Web first**; World App mini-app later (“web-first-both”) |
| Tokens in UI | **Both WLD + SOL** selectable in v1 |
| Visual | **Hybrid look** — Japanese Plinko board + Onyx shell |
| Stack route | **A + B** — Next.js App Router shell + **Phaser or Pixi** game board |
| Wallet | Solana **Wallet Adapter** (Phantom et al.) for SOL; WLD connect when feasible, else labeled placeholder toward World |
| Domain | `plinko.onyxlab.dev` (can rename later) |
| Custody | Never hold keys or real funds in v1 |

## Out of scope (v1)

- Real WLD/SOL deposits, withdrawals, or on-chain settle
- House bank / liquidity contracts / provably-fair server RNG (demo uses client physics / seed)
- Cross-chain bridges
- World App mini-app packaging (roadmap after web)
- Chat, members count, social rooms (reference UI chrome only if cheap)
- App Store / Play native apps
- Merging into Vault or Swap codebases (may link from onyxlab.dev)

## Architecture

```
Browser (Next.js App Router · Vercel)
  ├─ Onyx shell: connect wallet, WLD|SOL toggle, virtual balance, BUY / AUTO / SPEED
  ├─ Phaser (or Pixi) canvas: pegs, balls, multiplier bins, JP art layer
  └─ Demo ledger: address + asset → chip balance (localStorage; optional thin API later)
        │
        ▼ v1.1 (not built now)
  On-chain bet / payout (Solana program and/or World Chain) + World App entry
```

- Deploy: Vercel + DNS `plinko.onyxlab.dev`
- No private keys on servers; demo balances are not real assets
- Clear **“Demo — not real funds”** copy in UI and meta description

### Why A + B

- **A (Next.js)** matches Swap hosting, SEO, and Wallet Adapter patterns.
- **B (Phaser/Pixi)** handles AUTO, SPEED, and ball physics/animation better than ad-hoc Canvas alone.
- Real money (former option C) deferred to keep hybrid scope honest.

## UI & gameplay

Mobile-first vertical layout inspired by reference Plinko, Onyx chrome:

1. **Header:** Plinko · Onyx Labs, virtual balance (+ disabled or “demo” only), wallet connect, optional settings  
2. **Board:** Japanese illustration underlay + glowing peg triangle + balls; ticker copy optional (PACHINKO / HAVE FUN)  
3. **Bins:** Multiplier row (high on edges, lower center — e.g. 100x … 0.5x … 100x); exact table tunable in config  
4. **Controls:** BUY BALLS (primary), AUTO (N balls), SPEED (1x–5x playback only)  
5. **Asset toggle:** WLD | SOL — switches label and which demo ledger bucket; does not move real tokens in v1  
6. **Guest play:** allowed with ephemeral chips (may reset on refresh)  
7. **Connected play:** chips keyed by `(walletAddress, asset)` persist in same browser  

### Guest vs wallet

| Mode | Balance storage | Notes |
| --- | --- | --- |
| Guest | Session / local, not tied to chain | Can reset on clear storage |
| Connected | `localStorage` key per address + asset | Same browser persists |

## Data flow

1. Connect (SOL via Wallet Adapter) → read address → load demo balance for selected asset.  
2. BUY / AUTO → if balance ≥ ball cost → debit → spawn ball in Phaser → land in bin → credit `cost × multiplier` → persist.  
3. Insufficient chips → disable CTA + short message; **no** real deposit flow in v1.  
4. Disconnect / account switch → stop AUTO; in-flight ball finishes; settle against address at drop start.  
5. WLD: if no browser wallet, still allow selecting WLD label + guest chips; show soft CTA for World App (v1.1).  
6. SPEED changes animation rate only; outcome rules stay the same for a given drop seed.

## Error handling

- Wallet reject / unavailable → stay on page, clear message, keep guest path.  
- Phaser load fail → show retry; do not debit chips until board ready.  
- Storage quota / private mode → fall back to in-memory guest chips + warn.  
- Never auto-broadcast chain txs in v1 (there are none).

## Security & compliance posture (v1)

- Demo-only; no custody; no KYC in v1.  
- Do not market as real gambling until legal review for real-money v1.1.  
- HTTPS, sensible CSP; no seed phrases.  
- SEO baseline like other Onyx sites (title, description, OG, robots, sitemap) with demo disclaimer.

## Acceptance criteria (v1 done)

1. `plinko.onyxlab.dev` (or agreed domain) loads on mobile width; Onyx shell + JP-style board visible.  
2. Guest can BUY BALLS, see drop, and balance updates.  
3. Phantom (Wallet Adapter) connects; SOL-tagged demo balance persists per address in that browser.  
4. WLD toggle visible; works as second demo ledger (connect path best-effort).  
5. AUTO and SPEED work without double-debit bugs.  
6. Persistent **Demo — not real funds** labeling.  
7. No mainnet token transfers occur in any happy path.

## Roadmap (not v1)

- **v1.1:** Real stakes (start with one chain), house bank / escrow, stronger RNG story, World App entry.  
- Art polish: commissioned board illustration; sound; more bin configs.  
- Optional: onyxlab.dev homepage card.

## Open names

Working title **Plinko**; final marketing name can change without changing architecture.
