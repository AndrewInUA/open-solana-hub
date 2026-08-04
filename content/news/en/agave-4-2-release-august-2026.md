---
title: 'Agave 4.2: cheaper rent, larger transactions, faster slots – Alpenglow on deck'
date: '2026-08-03'
tag: Clients
description: >-
  Agave 4.2 ships cheaper rent, larger transactions, and 200ms slots. Alpenglow code is
  feature-complete for test clusters, with mainnet activation targeted for Agave 4.3 in October
  2026.
teaser: >-
  Anza's August release cuts rent ~90%, raises max tx size to 4096 bytes, and targets 200ms slots.
  Full Alpenglow code ships for testing; mainnet consensus flip waits for 4.3.
---

Anza shipped **Agave 4.2**, the next release of Solana's primary validator client.
 Three feature-gated upgrades are headed for mainnet activation starting the week of August 17, 2026:
 a deep cut to on-chain rent, larger transactions, and shorter slot times. The same release carries
 the complete [Alpenglow](./alpenglow-consensus-status-july-2026.html) consensus code –
 ready for community testing, but not activated on mainnet until Agave 4.3.

      

## What ships in 4.2

      

- **90% rent reduction (SIMD-0437):** the storage bond constant falls from 6,960 to 696 lamports per byte, rolled out across five feature gates so the network can watch state growth at each step. A typical SPL token account deposit drops from roughly sixteen cents of SOL to about one and a half – making it far more practical for apps to cover rent for users.
- **Larger transactions (SIMD-0296):** max transaction size rises from 1,232 to 4,096 bytes via a new transaction `v1` format. Existing `v0` and legacy transactions keep working. Workloads that never fit in one tx – ZK proofs, large multisigs, BLS schemes – can land atomically instead of being stitched across lookups or bundles.
- **200ms slots (SIMD-0525):** slot time halves from 400ms to 200ms in four 50ms steps. If skip rates climb too high, the network pauses before the next decrement. Users see confirmations sooner; each leader's monopoly window over a block also shrinks.

      

## Alpenglow: in the binary, not on mainnet yet

      

Agave 4.2 is the first public release with the full Alpenglow codebase. Validators can run it on the
 community test cluster while researchers review the consensus surface. Mainnet activation is expected
 in **Agave 4.3**, currently targeted for October 2026 – not in 4.2 itself.

      

Alongside the release, Anza opened an Alpenglow security competition with a prize pool of up to
 50,000 SOL. Submissions run from August 5 to August 19, 2026 (UTC), covering the Votor voting engine
 and related BLS verification crates. That window sits right next to the mainnet feature activations –
 a deliberate hardening step before consensus flips later in the year.

      

## What it means for…

      

### Validators

      

Plan an Agave 4.2 upgrade window before the August 17 activation week. Watch skip rates as slot times
 step down, and use the test cluster if you want early Alpenglow practice. Operators who stay current
 will matter more as 4.3 approaches – follow public operator channels for client-version notes.

      

### Delegators

      

No restaking or wallet migration. The practical signal is operator readiness: prefer validators who
 communicate client versions and handle upgrades cleanly. Faster slots and cheaper rent improve the
 apps you use; Alpenglow itself is still ahead.

      

### Builders

      

Cheaper rent changes product economics for account-heavy apps. Transaction `v1` unlocks
 larger payloads in one atomic call – worth adopting when you need the headroom. Indexers that decode
 raw transaction bytes need to recognize the new layout. Design for 200ms slots, but treat Alpenglow
 finality (~150ms) as a 4.3-era assumption, not a 4.2 one.

      

### Everyone else

      

Wallets and apps should feel snappier as slots shorten, and creating token accounts or other on-chain
 state gets cheaper when rent gates activate. Nothing to configure if you are just holding or using SOL.

      

<div class="callout">
<strong>In one sentence</strong>
        Agave 4.2 makes Solana cheaper and faster this August, and stages the full Alpenglow consensus code
        for a later 4.3 mainnet flip – not an instant consensus switch.
</div>

      

Source:
 [Solana Foundation – Agave 4.2 release overview](https://solana.com/upgrades/agave-4-2-release-overview)
