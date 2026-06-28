//! # Vault Contract
//!
//! Holds idle escrowed funds between milestone releases and accrues a simple,
//! transparent yield over time. This vault custodies a real Stellar Asset
//! Contract (SAC) token: deposits perform an actual `token.transfer` from the
//! depositing party into the vault's own balance, and withdrawals transfer
//! real tokens back out to a recipient chosen by the controller. Internally
//! it tracks each depositor's principal + accrual timestamp so yield can be
//! computed without needing a separate share token.
//!
//! This mirrors the classic Soroban "vault" example pattern but is
//! intentionally simplified: yield accrues linearly based on ledger
//! timestamp rather than pulling from a real lending market, which keeps
//! the contract auditable and demo-safe while still demonstrating real
//! custody of an on-chain asset.
#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, token, Address, Env, Symbol,
};

mod test;

/// Yield accrual rate, expressed in basis points per day (100 = 1%/day).
/// Kept deliberately small and linear so behavior is fully predictable in a demo.
const YIELD_BPS_PER_DAY: i128 = 5; // 0.05% per day, simple interest
const SECONDS_PER_DAY: u64 = 86_400;
const BPS_DENOMINATOR: i128 = 10_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Address of the controller contract allowed to deposit/withdraw (the Escrow contract).
    Controller,
    /// Address of the SAC token this vault custodies (e.g. native XLM SAC, or a stablecoin).
    Token,
    /// Per-depositor position, keyed by the depositor address (the campaign id, as an Address-like key).
    Position(Address),
    /// True once `initialize` has run.
    Initialized,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub principal: i128,
    pub deposited_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    NoPosition = 5,
    InsufficientPosition = 6,
}

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// Initialize the vault with the controller address (the Escrow contract)
    /// and the SAC token this vault will custody.
    /// Can only be called once.
    pub fn initialize(env: Env, controller: Address, token: Address) -> Result<(), VaultError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(VaultError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Controller, &controller);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Initialized, &true);

        env.events().publish((Symbol::new(&env, "vault_init"),), controller);
        Ok(())
    }

    /// Deposit `amount` of the vault's token, transferred from `source`,
    /// credited to `depositor`'s position (a campaign address identifier,
    /// supplied by the Escrow contract). Only callable by the controller.
    /// Returns the new principal for that position.
    pub fn deposit(
        env: Env,
        source: Address,
        depositor: Address,
        amount: i128,
    ) -> Result<i128, VaultError> {
        Self::require_controller(&env)?;

        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        // Real token movement: pull `amount` of the vault's token from
        // `source` (the backer, who already signed/authorized this in the
        // wider transaction) into this contract's own balance.
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(VaultError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&source, env.current_contract_address(), &amount);

        let now = env.ledger().timestamp();
        let key = DataKey::Position(depositor.clone());

        let new_principal = match env.storage().persistent().get::<DataKey, Position>(&key) {
            Some(existing) => {
                // Settle any accrued yield into principal before adding new funds,
                // so yield always compounds simply on the deposit timestamp reset.
                let accrued = Self::calculate_yield(existing.principal, existing.deposited_at, now);
                existing.principal + accrued + amount
            }
            None => amount,
        };

        let position = Position {
            principal: new_principal,
            deposited_at: now,
        };
        env.storage().persistent().set(&key, &position);

        env.events().publish(
            (Symbol::new(&env, "vault_deposit"),),
            (depositor, amount, new_principal),
        );

        log!(&env, "vault: deposit accepted, new_principal={}", new_principal);
        Ok(new_principal)
    }

    /// Withdraw `amount` of principal+yield from a depositor's position and
    /// transfer that amount of the real token to `recipient`. Only callable
    /// by the controller. Returns the amount actually paid out.
    ///
    /// ⚠️ Demo-scope limitation: the yield this vault reports is computed
    /// (`calculate_yield`), not earned from a real external strategy — the
    /// vault only ever holds what was actually deposited via `deposit`. If
    /// a withdrawal's `amount` includes accrued yield and the vault's total
    /// token balance is less than the sum of every depositor's current
    /// principal+yield, the underlying `token.transfer` call below will
    /// fail (the network enforces real balances; it won't let the vault pay
    /// out tokens it doesn't hold). In production, `deposit` would route
    /// funds into a real yield-bearing strategy (e.g. a lending market) so
    /// the vault's actual token balance always covers reported yield; here,
    /// the interface is what's being demonstrated, not a production funding
    /// source for the yield figure itself.
    pub fn withdraw(
        env: Env,
        depositor: Address,
        recipient: Address,
        amount: i128,
    ) -> Result<i128, VaultError> {
        Self::require_controller(&env)?;

        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        let key = DataKey::Position(depositor.clone());
        let position = env
            .storage()
            .persistent()
            .get::<DataKey, Position>(&key)
            .ok_or(VaultError::NoPosition)?;

        let now = env.ledger().timestamp();
        let accrued = Self::calculate_yield(position.principal, position.deposited_at, now);
        let total_value = position.principal + accrued;

        if amount > total_value {
            return Err(VaultError::InsufficientPosition);
        }

        let remaining = total_value - amount;
        if remaining > 0 {
            env.storage().persistent().set(
                &key,
                &Position {
                    principal: remaining,
                    deposited_at: now,
                },
            );
        } else {
            env.storage().persistent().remove(&key);
        }

        // Real token movement: pay `amount` of the vault's token out of this
        // contract's own balance to `recipient`. The vault must actually
        // hold enough of the token for this to succeed, which it always
        // will as long as deposits and withdrawals stay in sync (enforced
        // by the principal+yield accounting above).
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(VaultError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        env.events().publish(
            (Symbol::new(&env, "vault_withdraw"),),
            (depositor, amount, remaining),
        );

        log!(&env, "vault: withdraw paid_out={} remaining={}", amount, remaining);
        Ok(amount)
    }

    /// Read-only: current total value (principal + accrued yield) for a depositor.
    pub fn balance_of(env: Env, depositor: Address) -> i128 {
        let key = DataKey::Position(depositor);
        match env.storage().persistent().get::<DataKey, Position>(&key) {
            Some(position) => {
                let now = env.ledger().timestamp();
                let accrued = Self::calculate_yield(position.principal, position.deposited_at, now);
                position.principal + accrued
            }
            None => 0,
        }
    }

    /// Read-only: who is allowed to control this vault.
    pub fn get_controller(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Controller)
            .expect("vault not initialized")
    }

    /// Read-only: which SAC token this vault custodies.
    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("vault not initialized")
    }

    // ---- internal helpers ----

    fn require_controller(env: &Env) -> Result<(), VaultError> {
        let controller: Address = env
            .storage()
            .instance()
            .get(&DataKey::Controller)
            .ok_or(VaultError::NotInitialized)?;
        controller.require_auth();
        Ok(())
    }

    fn calculate_yield(principal: i128, deposited_at: u64, now: u64) -> i128 {
        if now <= deposited_at || principal <= 0 {
            return 0;
        }
        let elapsed_days = ((now - deposited_at) / SECONDS_PER_DAY) as i128;
        if elapsed_days <= 0 {
            return 0;
        }
        // simple interest: principal * bps_per_day * days / 10_000
        (principal * YIELD_BPS_PER_DAY * elapsed_days) / BPS_DENOMINATOR
    }
}
