#!/usr/bin/env bash
# Deploys Vault, Escrow, and Registry to Stellar testnet, wires them together,
# and prints every address + transaction hash you need for the submission
# checklist (contract deployment address, transaction hash for an interaction).
#
# The campaign uses the native XLM Stellar Asset Contract as its token, so
# pledges/releases move real testnet XLM between accounts.
#
# Prerequisites:
#   - rustup with a recent stable toolchain (1.85+) and the wasm32v1-none target
#   - stellar-cli installed: cargo install --locked stellar-cli
#   - an identity funded on testnet, e.g.:
#       stellar keys generate --global deployer --network testnet --fund
#
# Usage:
#   ./scripts/deploy.sh
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-deployer}"

echo "==> Building contracts (release, wasm32v1-none)"
( cd contracts/vault    && stellar contract build )
( cd contracts/escrow   && stellar contract build )
( cd contracts/registry && stellar contract build )

echo "==> Resolving native XLM SAC token address"
TOKEN_ID=$(stellar contract id asset --asset native --network "$NETWORK")
echo "    Token (native XLM SAC): $TOKEN_ID"

echo "==> Deploying Vault contract"
VAULT_ID=$(stellar contract deploy \
  --wasm contracts/vault/target/wasm32v1-none/release/vault.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "    Vault contract ID: $VAULT_ID"

echo "==> Deploying Escrow contract"
ESCROW_ID=$(stellar contract deploy \
  --wasm contracts/escrow/target/wasm32v1-none/release/escrow.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "    Escrow contract ID: $ESCROW_ID"

echo "==> Deploying Registry contract"
REGISTRY_ID=$(stellar contract deploy \
  --wasm contracts/registry/target/wasm32v1-none/release/registry.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "    Registry contract ID: $REGISTRY_ID"

DEPLOYER_ADDRESS=$(stellar keys address "$SOURCE")

echo "==> Initializing Vault (controller = Escrow contract, token = native XLM)"
stellar contract invoke \
  --id "$VAULT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  --send=yes \
  -- initialize \
  --controller "$ESCROW_ID" \
  --token "$TOKEN_ID"

DEADLINE=$(($(date +%s) + 30 * 86400))

echo "==> Initializing Escrow (sample campaign, 30 day deadline)"
stellar contract invoke \
  --id "$ESCROW_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  --send=yes \
  -- initialize \
  --creator "$DEPLOYER_ADDRESS" \
  --arbiter "$DEPLOYER_ADDRESS" \
  --vault "$VAULT_ID" \
  --goal 1000000000 \
  --deadline "$DEADLINE" \
  --milestones '[["Prototype complete",4000],["Beta launch",3000],["Public release",3000]]'

echo "==> Registering the campaign in the Registry (this is your sample tx hash)"
stellar contract invoke \
  --id "$REGISTRY_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  --send=yes \
  -- register_campaign \
  --creator "$DEPLOYER_ADDRESS" \
  --title "Solar Lantern for Rural Schools" \
  --category "Education" \
  --escrow_address "$ESCROW_ID"

cat <<EOF

==================================================================
 DEPLOYMENT COMPLETE - save these for your submission checklist
==================================================================
 Network:           $NETWORK
 Token (XLM SAC):    $TOKEN_ID
 Vault contract:     $VAULT_ID
 Escrow contract:    $ESCROW_ID
 Registry contract:  $REGISTRY_ID
 Deployer address:   $DEPLOYER_ADDRESS

 Next steps:
  1. Copy the transaction hash printed above the "register_campaign"
     invocation output (stellar contract invoke prints the tx hash to
     stderr when --send=yes) into your README/checklist.
  2. Put the three contract IDs into frontend/.env.local
     (see frontend/.env.example).
  3. Try a pledge to generate a second transaction hash (note: pledging
     requires the backer to hold testnet XLM, and Soroban will request
     authorization for the underlying token transfer automatically):
       stellar contract invoke --id $ESCROW_ID --source $SOURCE \\
         --network $NETWORK --send=yes -- pledge \\
         --backer $DEPLOYER_ADDRESS --amount 50000000
==================================================================
EOF
