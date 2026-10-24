# Onyx Plinko v1.1 — Real SOL Stakes Design Spec

**Date:** 2026-10-25 (Asia/Hong_Kong)  
**Brand:** Onyx Labs · onyxlab.dev  
**Product (working name):** Plinko  
**Domain:** https://plinko.onyxlab.dev  
**Repo:** https://github.com/ilovemagicker/onyx-plinko  
**Status:** Design approved by 老闆 (brainstorming complete)  
**Depends on:** [v1 demo design](./2026-10-25-onyx-plinko-design.md) (shipped)

## Goal

Add **real SOL stakes** on top of the live demo Plinko, without removing demo play. Users can toggle **Demo | Real**. Real mode uses a **Solana program vault** (smart contract escrow), **deposit-then-play credits**, and **commit–reveal** fairness. WLD real stakes and World App packaging stay later.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| First real asset | **SOL only** (WLD real later) |
| Custody | **On-chain program escrow** — deposits into user PDA / vault; no user private keys on servers |
| Play UX | **Deposit credits** — one deposit, then BUY / AUTO debit balance (not one tx per ball) |
| Fairness | **Commit–reveal** (server seed + client salt; verifiable after reveal) |
| Demo coexistence | **Both modes** — Demo \| Real toggle; demo keeps localStorage ledger |
| Architecture route | **A** — program vault + thin API for commit/reveal; deposit/withdraw on-chain |
| Surface | Same web app at `plinko.onyxlab.dev`; World App still later |

## Out of scope (v1.1)

- Real WLD / World Chain stakes
- Full on-chain VRF or one signed tx per ball
- Off-chain batch settlement without per-ball reveal accountability (route C)
- KYC / geo productization (basic disclaimers only; legal review before marketing as gambling)
- Bridges, cross-chain deposits
- Custodial hot-wallet house that signs payouts with a server key as the primary model
- Changing Phaser board art beyond wiring Real outcomes

## Architecture

```
Browser (existing Next.js + Phaser + Wallet Adapter)
  ├─ Mode: Demo | Real
  ├─ Demo → localStorage ledger (unchanged)
  └─ Real → read/write Solana user vault PDA
        │
        ├─ deposit / withdraw  (user-signed txs)
        │
        └─ BUY / AUTO ball
              ├─ POST /api/plinko/commit  → commitHash + locked bin/mult (seed hidden)
              ├─ Phaser animates to locked bin
              └─ reveal (API + program ix) → debit cost, credit cost × mult
```

- **Program (Anchor recommended):** house/liquidity vault + per-user balance PDA; instructions: `initialize`, `deposit`, `withdraw`, `lock_for_play` / `settle_reveal` (exact ix names tunable in plan).
- **Thin API (Vercel):** holds commit secrets until reveal; never holds user keys; uses house authority only if program requires a co-signer for settle (prefer program-enforced settle from reveal proof).
- **House liquidity:** separate funded vault account; if liquidity too low, reject new Real balls.
- Deploy: same Vercel project; program on **devnet first**, then mainnet.

### Why route A

- Matches deposit-credits UX and AUTO without spamming signatures.
- Stronger than hot-wallet custody; lighter than full on-chain VRF per ball.
- Commit–reveal gives post-hoc verification without blocking animation on VRF latency.

## UI & gameplay deltas

1. **Mode toggle:** Demo \| Real next to asset control; Real forces **SOL** (WLD disabled or “soon”).
2. **Real balance:** from PDA; show Deposit / Withdraw.
3. **Labels:** Demo keeps “Demo — not real funds”; Real shows clear **Real SOL** + risk copy.
4. **BUY / AUTO:** same controls; Real path goes through commit → animate → reveal settle.
5. **Guest:** Demo only; Real requires connected Phantom (or Wallet Adapter wallet).
6. **SPEED:** animation only; does not change locked outcome for a ball.

## Data flow (Real)

1. Connect wallet → optionally `deposit(lamports)` → PDA balance updates.
2. BUY / AUTO ball N: client sends `clientSalt` + `cost` → API creates `ballId`, computes outcome from `serverSeed`, stores `commitHash = H(serverSeed, clientSalt, ballId, cost, …)`, returns commit + **locked bin/multiplier** (not the seed).
3. Client may `lock_for_play` on-chain (or lock is implied at settle — prefer explicit lock so withdraw cannot race). Balance reserved ≥ cost.
4. Phaser plays to locked bin.
5. On land: `reveal` with seed (+ proof fields) → program verifies hash, applies `balance -= cost; balance += floor(cost * mult)` (exact rounding in plan), emits event.
6. Withdraw: user-signed; cannot withdraw locked amount for in-flight balls.
7. Insufficient balance / liquidity → disable CTA; no silent demo fallback in Real mode.

## Commit–reveal rules

- Server seed: high-entropy, unique per ball; never sent to client before reveal.
- After reveal, anyone can recompute `commitHash` and bin mapping from published table + seed.
- Bin/multiplier table for Real is **versioned and published** (same config id in commit payload).
- Client physics in Real mode is **cosmetic**; authority is the locked commit outcome (unlike v1 demo).

## Error handling

| Case | Behavior |
| --- | --- |
| User rejects deposit/withdraw | Stay on page; balances unchanged |
| Commit API down | Block Real BUY; offer Demo |
| Reveal timeout / RPC fail | Retry settle; do not drop lock without refund path |
| Wallet disconnect mid-AUTO | Stop AUTO; finish in-flight ball settle if lock exists |
| Program liquidity low | Reject new commits with clear message |

## Security & compliance posture

- No user private keys on servers.
- Rate limits, per-ball and per-day caps (numeric limits set in implementation plan / config).
- Devnet soak before mainnet; separate program IDs and API secrets per env.
- Do not market as real gambling until legal review; site keeps age/risk disclaimer in Real mode.
- CSP / HTTPS as v1; never log seeds in client analytics.

## Acceptance criteria (v1.1 done)

1. Demo mode still works exactly as v1 (no regressions).
2. Real mode: deposit SOL → BUY ball → animation → balance changes on-chain per multiplier table.
3. Withdraw returns unlocked SOL to user wallet.
4. After reveal, commit can be independently verified from published inputs.
5. AUTO works in Real without one wallet popup per ball (deposit already done).
6. Clear Demo vs Real labeling; WLD real stakes not offered.
7. Devnet demo path documented; mainnet launch is an explicit ops step.

## Roadmap after v1.1

- WLD / World Chain real stakes + World App entry
- Stronger on-chain entropy (VRF) if needed
- Homepage card / marketing after legal OK
- Optional: session receipts UI, public verify page

## Open parameters (fixed in implementation plan, not blockers)

- Exact Anchor ix names and PDA seeds
- Numeric max bet / daily cap / house min liquidity
- Whether settle is permissionless reveal vs house co-sign
- Mainnet go-live checklist owner
