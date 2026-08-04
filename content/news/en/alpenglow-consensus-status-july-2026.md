---
title: 'Alpenglow moves closer to mainnet: where Solana''s biggest consensus change stands'
date: '2026-07-15'
tag: Consensus
description: >-
  Where Solana's Alpenglow consensus upgrade stands in July 2026: Votor, ~150ms finality, the end of
  on-chain vote transactions, testnet timing, and what it means for stakers.
teaser: >-
  Votor consensus is rolling out through Agave, with testnet activation this summer and mainnet
  targeted for late 2026. What ships now, what waits, and what changes for validators.
---

Alpenglow is the largest change to how Solana agrees on blocks since the network launched.
 As of mid-July 2026 it is rolling out through the Agave validator client, with testnet activation
 expected this summer and mainnet activation later in the year, after community testing and security audits.

      

<div class="callout">
<strong>August 2026 update</strong>
        <a href="./agave-4-2-release-august-2026.html">Agave 4.2</a> now ships the complete Alpenglow codebase
        for community test clusters and security review. Mainnet activation is expected in Agave 4.3
        (targeted for October 2026), not in 4.2. Anza is also running an Alpenglow bug bounty
        (up to 50,000 SOL) from August 5–19, 2026.
</div>

      

## What Alpenglow actually is

      

Today, Solana validators agree on the state of the network using Tower BFT, supported by Proof of History,
 and they cast their votes as regular on-chain transactions. Those vote transactions are invisible to most
 users but consume a large share of every block (commonly cited at around three quarters of block space).

      

Alpenglow replaces this with a new voting and finality protocol called **Votor**. Votes move
 off-chain into direct messages between validators, and the network can finalize a block in roughly
 100–150 milliseconds, down from several seconds today. For everyday use, that is the difference between
 "wait a moment" and "as fast as tapping a bank card."

      

## How it got here

      

- **May 2025:** Anza unveiled Alpenglow at Solana Accelerate, written up as SIMD-0326.
- **September 2025:** the validator governance vote passed with about 98% approval, one of the strongest mandates in Solana's history.
- **May 2026:** Alpenglow went live on a community test cluster, the first time external validators ran it.
- **July 2026:** the final feature flag work has been merged into Agave; testnet activation is expected over the summer, with mainnet to follow once audits and testing complete. Most estimates point to late 2026.
- **July 31 / August 2026:** Agave 4.2 ships with feature-complete Alpenglow for test clusters; mainnet consensus activation is targeted for Agave 4.3 in October 2026.

      

## What it changes, and what it does not

      

The version heading to mainnet covers the Votor consensus change only. Other parts of the original
 Alpenglow paper (the Rotor data-distribution layer and slashing mechanisms) are deferred to future
 proposals. So the headline improvement is finality time and the removal of vote transactions, not
 the full redesign in one step.

      

One notable economic change: Alpenglow introduces a **Validator Admission Ticket (VAT)**,
 a fee (currently proposed at 1.6 SOL per epoch) that validators pay to participate in consensus. Combined
 with the removal of per-vote transaction fees, this reshapes validator operating costs, which is worth
 watching if you care about the health of smaller independent validators.

      

## What it means for…

      

### Validators

      

Alpenglow is delivered through Agave releases, so plan upgrade windows early. Vote transactions
 leave the blocks, and the Validator Admission Ticket (VAT, currently proposed at 1.6 SOL per epoch)
 replaces per-vote fees. Operating costs shift; smaller independent operators need to model the
 new economics before mainnet activation.

      

### Delegators

      

No migration or restaking required. The indirect effect is validator economics: operators who
 communicate upgrade plans and stay current on Agave handle the transition better than those who
 lag.

      

### Builders

      

Finality drops to roughly 100–150 ms once Votor is live on mainnet. Apps that today wait several
 seconds for confirmation can tighten UX assumptions, though the full Rotor layer (faster block
 propagation in simulations) ships later. Design for Votor-only improvements first.

      

### Everyone else

      

If you hold or use SOL without running infrastructure, the practical change is faster transaction
 confirmations in wallets and apps. Nothing to configure on your side.

      

<div class="callout">
<strong>In one sentence</strong>
        Alpenglow replaces Solana's original voting system with a faster, simpler one: finality in a blink.
        The full code is in Agave 4.2 for testing; mainnet activation is aimed at Agave 4.3 later in 2026.
</div>
