# 🚀 Vaulted - Milestone Crowdfunding on Stellar

Vaulted is an advanced, production-ready milestone-gated crowdfunding platform built on Soroban (Stellar's smart contract platform). It solves the web3 "rug pull" problem by locking backer pledges in an on-chain Escrow and Vault, and releasing them only when predefined milestones are approved by a trusted arbiter. Every pledge, approval, and release is a transparent, auditable on-chain event.

## 🔗 Live Demo & Video Pitch

- **Live Platform**: [Insert your Vercel URL here]
- **Demo Video**: [Watch the Demo on Google Drive](https://drive.google.com/file/d/1XYoDWMFTn0EkLKJrf-lUs12sV08JrcMl/view?usp=sharing)

## 🌟 Key Features

1. **Milestone-based Escrow**: Creators define project milestones (e.g., Prototype = 40% of funds). Capital is locked and fully protected.
2. **Decentralized Arbitration**: An arbiter reviews real-world progress and approves milestones, keeping creators strictly accountable.
3. **Genuine Cross-Contract Architecture**: A three-contract dependency graph (`Registry → Escrow → Vault`) where the Escrow makes real cross-contract calls to the Vault to manage the Stellar Asset Contract (SAC).
4. **Real-time Event Streaming**: Live activity feed powered by polling Soroban RPC, updating instantly as milestones are approved and funds are released on the ledger.
5. **Premium UI**: Built with Next.js 14 and Tailwind CSS, featuring a sleek dark mode aesthetic with glassmorphism and robust real-time transaction states. Fully mobile responsive.

---

## 📸 Platform Gallery

### 1. Mobile Responsive UI
![Mobile UI](./images/Mobile_responsive_%20UI.png)

### 2. CI/CD Pipeline Running
![CI/CD Pipeline](./images/CI_CD_pipeline%20_running.png)

### 3. Test Output (3+ passing tests)
![Test Output](./images/test_output.png)

---

## ✅ Submission Checklist & Deliverables

Here are the required deliverables for this submission:

- **Public GitHub repository:** [Insert your GitHub Repo URL here]
- **README with complete documentation:** (This file!)
- **Minimum 10+ meaningful commits:** Completed (View commit history)
- **Live demo link (Vercel):** [Insert your Vercel URL here]
- **Contract deployment address:** `CCLADM5BEFRQYHCCBIDE7TAPJJVOVOKIFUMXRIS7SYVEOXSXLRBWGG52` (Fresh Escrow Contract)
- **Transaction hash:** [b9a6ca417...](https://stellar.expert/explorer/testnet/tx/b9a6ca41713ce2605d77876bc1ade4bf69785f7f75b323ba20f5d110296ec2a9)
- **Demo video link:** [Watch on Google Drive](https://drive.google.com/file/d/1XYoDWMFTn0EkLKJrf-lUs12sV08JrcMl/view?usp=sharing)

---

## 🛠️ Architecture & Technical Documentation

A real crowdfunding product needs more than "send money, mint an NFT." It needs trust: backers want assurance their money won't just disappear, and creators want to be paid for work actually delivered. Three contracts model that directly:

```text
                 registers campaigns,                 holds pledges,
                 reads live status                    manages milestones
        ┌─────────────┐   ────────────▶   ┌─────────────┐
        │  Registry   │                   │   Escrow    │
        └─────────────┘   ◀────────────   └──────┬──────┘
                            campaign_status()            │
                                                          │ deposit() / withdraw()
                                                          ▼
                                                   ┌─────────────┐
                                                   │    Vault    │
                                                   └─────────────┘
                                              holds idle funds,
                                              accrues simple yield
```

- **Vault** — a minimal yield-bearing pool. Holds principal per depositor and accrues linear interest based on ledger timestamp. Only its `controller` (the Escrow contract) can deposit or withdraw on a depositor's behalf.
- **Escrow** — owns a single campaign's lifecycle: accepting pledges, tracking milestones, approving and releasing funds, and issuing refunds if a campaign fails to reach its goal. Every pledge and release is a real **cross-contract call** into the Vault contract.
- **Registry** — the public discovery layer. Anyone can list a deployed Escrow contract as a campaign. Its `campaign_status` view **cross-calls into the Escrow contract** to read live state, so the registry never goes stale.

## 💻 Local Development Setup

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable, 1.85+) with the `wasm32v1-none` target: `rustup target add wasm32v1-none`
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli): `cargo install --locked stellar-cli`
- Node.js 20+
- [Freighter](https://www.freighter.app/) browser wallet extension

### Build & Deploy to Testnet

```bash
# one-time: create and fund a deployer identity
stellar keys generate --global deployer --network testnet --fund

# build, deploy, wire up, and register a sample campaign
NETWORK=testnet SOURCE=deployer ./scripts/deploy.sh
```

The script prints the Vault, Escrow, and Registry contract IDs. Copy the Registry contract ID into `frontend/.env.local`.

### Run the Frontend

```bash
cd frontend
cp .env.example .env.local   # then fill in NEXT_PUBLIC_REGISTRY_CONTRACT_ID
npm install
npm run dev
```

Visit `http://localhost:3000`, connect Freighter (set to Testnet), and explore the application.

## ⚙️ CI/CD & Testing

- **`.github/workflows/ci.yml`** runs on every push and pull request: builds and tests all three contracts (in dependency order), runs `clippy` and `cargo fmt --check`, then lints, type-checks, tests, and builds the frontend. 
- **`.github/workflows/deploy.yml`** is a manually-triggered workflow that builds and deploys all three contracts to a chosen network and prints the resulting contract IDs to the run summary.
