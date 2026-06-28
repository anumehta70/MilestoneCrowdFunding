# Submission Checklist — Evidence Map

This file exists so a reviewer can verify every requirement in under five
minutes. Each row links the requirement to the exact file, command, or
artifact that satisfies it.

## Advanced smart contract development

| Requirement | Evidence |
|---|---|
| Inter-contract communication | `contracts/escrow/src/lib.rs` calls `Vault.deposit` / `Vault.withdraw` via `vault_contract::Client` (see `pledge`, `release_milestone`, `refund`) — these move a real Stellar Asset Contract token, not abstract bookkeeping. `contracts/registry/src/lib.rs` calls `Escrow.get_total_pledged` / `get_total_released` / `get_goal` / `get_deadline` via `escrow_contract::Client` in `campaign_status`. Both are exercised by integration tests that register the **real compiled wasm** of the dependency contract (and a real test SAC token), not mocks — see `test_pledge_forwards_real_tokens_to_vault_via_cross_contract_call` in `contracts/escrow/src/test.rs` and `test_campaign_status_cross_calls_live_escrow_state` in `contracts/registry/src/test.rs`. |
| Event streaming & real-time updates | Contracts emit `pledge_made`, `milestone_approved`, `funds_released`, `refund_issued`, `campaign_registered`, `vault_deposit`, `vault_withdraw` (see the "Events emitted" table in `README.md`). Frontend streams them live via `frontend/src/hooks/useEventStream.ts` (polls Soroban RPC `getEvents`) rendered in `frontend/src/components/LiveEventFeed.tsx`, visible on every campaign page. |
| CI/CD pipeline setup | `.github/workflows/ci.yml` — builds + tests all 3 contracts in dependency order, runs `clippy` + `cargo fmt --check`, then lints/type-checks/tests/builds the frontend. Runs on every push and PR. |
| Smart contract deployment workflow | `.github/workflows/deploy.yml` (manual `workflow_dispatch` + tag-triggered) deploys all 3 contracts and prints contract IDs to the GitHub Actions run summary. `scripts/deploy.sh` is the equivalent for local/manual deployment. |
| Mobile responsive frontend development | Tailwind mobile-first layouts throughout `frontend/src/app/**` and `frontend/src/components/**` (single-column on small screens, grid from `sm:`/`lg:` breakpoints up). See `docs/screenshots/mobile-*.png`. |
| Error handling & loading states | `frontend/src/components/StateViews.tsx` (`LoadingState`, `ErrorState` with retry, `EmptyState`) used in `app/page.tsx`, `app/campaign/[id]/page.tsx`, `app/create/page.tsx`. Wallet errors are typed (`WalletNotInstalledError`, `WalletRejectedError` in `lib/wallet.ts`) and surfaced distinctly. Contract call failures throw `ContractCallError` with the simulation diagnostic surfaced to the UI. |
| Writing tests for contracts and frontend | Contracts: 27 tests across `contracts/{vault,escrow,registry}/src/test.rs`. Frontend: 26 tests across `frontend/src/test/*.test.{ts,tsx}`. See "Tests" section of `README.md` for the breakdown and how to run them. |
| Production-ready architecture practices | Three-contract separation of concerns, typed error enums (`#[contracterror]`) instead of panics, `require_auth()` on every state-changing call, persistent vs. instance storage chosen deliberately, a pinned `rust-toolchain.toml`, environment-based frontend config (`.env.example`), and a single contract-call code path shared by reads and writes (`lib/contractClient.ts`). |
| Documentation & demo presentation | `README.md` (architecture, setup, contract reference, testing, CI/CD), this file, `docs/DEMO_SCRIPT.md`, and the demo video linked in `README.md` / submission form. |

## Submission checklist

| Item | Where to find it |
|---|---|
| Public GitHub repository | Push this project to a public repo, then add the link here. |
| README with complete documentation | `README.md` |
| Minimum 10+ meaningful commits | See "Suggested commit sequence" below — commit in stages rather than as one squashed commit. |
| Live demo link (Vercel/Netlify) | Deploy `frontend/` to Vercel (root directory = `frontend`); add the resulting URL here. |
| Contract deployment address | Output of `scripts/deploy.sh` or the `deploy.yml` workflow run summary; paste the three contract IDs here once deployed. |
| Transaction hash for contract interaction | Printed by `stellar contract invoke --send=yes` during `scripts/deploy.sh` (the `register_campaign` call), or any pledge you make through the UI — paste it here. |
| Screenshot: mobile responsive UI | `docs/screenshots/mobile-home.png`, `docs/screenshots/mobile-campaign.png` |
| Screenshot: CI/CD pipeline running | `docs/screenshots/ci-pipeline.png` (Actions tab, green checks on `ci.yml`) |
| Screenshot: test output with 3+ passing tests | `docs/screenshots/test-output-contracts.png`, `docs/screenshots/test-output-frontend.png` |
| Demo video link (1–2 min) | Add the link here once recorded; suggested shot list in `docs/DEMO_SCRIPT.md`. |

## Suggested commit sequence

Pushing everything as one commit will look like a dump, not a build. Stage it
to tell the real story:

1. `chore: initialize workspace and contract scaffolding`
2. `feat(vault): implement deposit/withdraw with linear yield accrual`
3. `test(vault): add unit tests for yield accrual and withdrawal edge cases`
4. `feat(escrow): implement campaign lifecycle with milestone tracking`
5. `feat(escrow): wire cross-contract calls to vault for pledge/release/refund`
6. `test(escrow): integration tests against real vault wasm`
7. `feat(registry): implement campaign registration and live status lookup`
8. `test(registry): integration tests against real escrow + vault wasm`
9. `feat(frontend): scaffold Next.js app with wallet connection`
10. `feat(frontend): campaign explore page with loading/error/empty states`
11. `feat(frontend): campaign detail page with pledge form and milestone timeline`
12. `feat(frontend): live event streaming via Soroban RPC polling`
13. `feat(frontend): create-campaign flow`
14. `test(frontend): unit tests for formatting utils and core components`
15. `ci: add test/build pipeline and contract deployment workflow`
16. `docs: README, submission checklist, demo script`
17. `chore: deploy contracts to testnet, wire frontend env`

Adjust to match what you actually build/change — the point is granularity,
not hitting an exact number.
