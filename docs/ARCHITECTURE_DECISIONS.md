# Architecture Decisions

Short rationale for the choices that aren't obvious from reading the code.

## Why three contracts instead of one

A single monolithic contract is easier to write but cannot demonstrate
inter-contract communication, and it conflates three genuinely different
concerns: discovery (Registry), campaign business logic (Escrow), and
capital efficiency (Vault). Splitting them also means each one has a small,
auditable surface area — the Vault, for instance, knows nothing about
campaigns, milestones, or backers; it only knows "controller can move funds
for a given key." That's the right shape for a piece of infrastructure other
contracts plug into.

## Why the Vault moves a real SAC token instead of tracking abstract numbers

An early version of this contract tracked deposits as plain `i128` ledger
entries with no actual asset behind them — that's bookkeeping, not escrow.
The shipped version has the Vault hold a real Stellar Asset Contract (SAC)
token: `deposit` performs an actual `token.transfer` from the source account
into the vault's own balance, and `withdraw` transfers real tokens back out
to a chosen recipient. This is what makes "funds are locked until a
milestone is approved" a true statement enforced by the network, not just
a claim the UI makes.

## Why `release_milestone` requires the arbiter's signature, not just "approved"

The first draft let anyone call `release_milestone` once a milestone was
marked approved, reasoning that the destination (the creator) and amount
were already fixed by the milestone config so nothing could be stolen. That
reasoning holds for fund safety, but it's still the wrong default: the
arbiter is the party accountable for "is this milestone *actually* done,
right now" and for triggering the real-world consequence (a token transfer)
that follows from that judgment. Requiring the arbiter to sign both
`approve_milestone` and `release_milestone` keeps a single accountable
signature on every payout, and is also a one-line change away from being a
multisig or DAO-vote signature instead of an individual key.

## Why a single `arbiter` address instead of a DAO vote

A real production system would want milestone approval gated behind a
multisig, a DAO vote, or an independent oracle/judge panel. Building that
voting logic well is a separate, sizeable problem from the escrow mechanics
themselves. `approve_milestone` is intentionally the only place that
decision is made, so swapping a single arbiter for a multisig contract later
means changing one `require_auth()` call, not the rest of the system.

## Why linear, on-ledger-timestamp yield instead of an external lending protocol

Pulling real yield from a lending protocol (Blend, etc.) is realistic, but
it adds a hard external dependency most reviewers can't easily verify
on a testnet snapshot, and a bug in that integration would block every test
in the rest of the system. The Vault's interface (`deposit`, `withdraw`,
`balance_of`) is exactly what a real yield-bearing backend would expose;
swapping the linear-interest internals for a real strategy doesn't change
any caller.

## Why pledges immediately forward to the Vault rather than sitting in Escrow

Two reasons: it demonstrates the cross-contract call on the most common user
action (pledging) rather than burying it in an edge case, and it reflects
the actual point of the product — idle backer capital shouldn't just sit
there doing nothing while a campaign runs for weeks or months.

## Why reads and writes share one code path in the frontend (`contractClient.ts`)

Soroban read-only calls are still full simulated invocations; the only
difference from a write is whether the result gets signed and submitted.
Sharing the build → simulate → (sign → submit) pipeline means there is one
error surface to handle (simulation failures), not two, and the frontend's
error states stay consistent whether you're reading a balance or submitting
a pledge.

## Why `i128` amounts are passed as strings through the frontend

JavaScript's `number` type loses precision above 2^53, and Soroban's `i128`
routinely exceeds that for any nontrivial XLM amount once converted to
stroops. Every amount that crosses the contract boundary is a `string`
(backed by `BigInt` internally) all the way from the RPC response to the UI,
and is only formatted to a human-readable decimal at the last moment
(`lib/format.ts`).
