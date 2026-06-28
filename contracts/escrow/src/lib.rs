//! # Escrow Contract
//!
//! Holds pledges for a single milestone-based crowdfunding campaign. Backers
//! pledge funds which are immediately swept into the Vault contract (so idle
//! capital accrues yield instead of sitting dormant). Funds are only released
//! to the campaign creator when a milestone is marked approved by the
//! designated arbiter (in production this would be a DAO vote or multisig;
//! here it's a single arbiter address for clarity, with the hook points
//! documented for upgrading to multisig later).
//!
//! This contract demonstrates Soroban **inter-contract communication**: every
//! pledge and release calls into the Vault contract's `deposit` / `withdraw`
//! functions using a generated client from `contractimport!`, and those calls
//! move a real Stellar Asset Contract (SAC) token, not just internal bookkeeping.
#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, log, vec, Address, Env, String, Symbol,
    Vec,
};

mod test;

// Import the compiled Vault contract WASM so we can generate a typed client
// and call it directly from this contract. This is the standard Soroban
// cross-contract pattern: build the dependency first, then import its wasm.
mod vault_contract {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/vault.wasm"
    );
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Initialized,
    Creator,
    Arbiter,
    VaultAddress,
    Goal,
    Deadline,
    TotalPledged,
    TotalReleased,
    Milestones,
    Pledge(Address),
    Backers,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub description: String,
    /// Percentage of total goal (in basis points, 10000 = 100%) released when approved.
    pub release_bps: u32,
    pub approved: bool,
    pub released: bool,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    CampaignExpired = 5,
    CampaignNotExpired = 6,
    MilestoneNotFound = 7,
    MilestoneAlreadyApproved = 8,
    MilestoneAlreadyReleased = 9,
    MilestoneNotApproved = 10,
    GoalNotReached = 11,
    NoPledgeFound = 12,
    InvalidMilestoneConfig = 13,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize a new campaign escrow.
    ///
    /// * `creator`   - receives released milestone funds
    /// * `arbiter`   - the address authorized to approve milestones
    /// * `vault`     - address of the deployed Vault contract used to hold idle funds
    ///                 (must already be initialized with this same campaign's token)
    /// * `goal`      - funding goal, in the smallest unit of the campaign's asset
    /// * `deadline`  - unix timestamp after which new pledges are rejected
    /// * `milestones`- ordered list of (description, release_bps); bps must sum to 10_000
    pub fn initialize(
        env: Env,
        creator: Address,
        arbiter: Address,
        vault: Address,
        goal: i128,
        deadline: u64,
        milestones: Vec<(String, u32)>,
    ) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(EscrowError::AlreadyInitialized);
        }
        if goal <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        let mut total_bps: u32 = 0;
        let mut stored_milestones: Vec<Milestone> = vec![&env];
        for (description, release_bps) in milestones.iter() {
            total_bps += release_bps;
            stored_milestones.push_back(Milestone {
                description,
                release_bps,
                approved: false,
                released: false,
            });
        }
        if total_bps != 10_000 || stored_milestones.is_empty() {
            return Err(EscrowError::InvalidMilestoneConfig);
        }

        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Creator, &creator);
        env.storage().instance().set(&DataKey::Arbiter, &arbiter);
        env.storage().instance().set(&DataKey::VaultAddress, &vault);
        env.storage().instance().set(&DataKey::Goal, &goal);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::TotalPledged, &0i128);
        env.storage().instance().set(&DataKey::TotalReleased, &0i128);
        env.storage().instance().set(&DataKey::Milestones, &stored_milestones);
        env.storage()
            .instance()
            .set(&DataKey::Backers, &Vec::<Address>::new(&env));

        env.events().publish(
            (Symbol::new(&env, "campaign_init"),),
            (creator, goal, deadline),
        );
        Ok(())
    }

    /// Pledge `amount` to the campaign. The caller must authorize the call
    /// (this authorization also covers the token transfer the Vault performs
    /// on their behalf, since it happens within the same invocation tree).
    /// Funds are immediately forwarded to the Vault contract to accrue yield
    /// while they wait to be released. This is the contract's primary
    /// **inter-contract call**: Escrow -> Vault.deposit(), which itself
    /// performs a real token.transfer from this backer into the vault.
    pub fn pledge(env: Env, backer: Address, amount: i128) -> Result<i128, EscrowError> {
        backer.require_auth();
        Self::require_initialized(&env)?;

        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() > deadline {
            return Err(EscrowError::CampaignExpired);
        }

        // Cross-contract call: forward funds into the Vault under this
        // campaign's own contract address as the position key, so all
        // backers' pledges pool together and accrue yield collectively.
        // The vault pulls the real token directly from `backer` (source).
        let vault_address: Address = env.storage().instance().get(&DataKey::VaultAddress).unwrap();
        let vault_client = vault_contract::Client::new(&env, &vault_address);
        let campaign_address = env.current_contract_address();
        vault_client.deposit(&backer, &campaign_address, &amount);

        // Track this backer's individual contribution for refund-eligibility / records.
        let pledge_key = DataKey::Pledge(backer.clone());
        let prior: i128 = env.storage().persistent().get(&pledge_key).unwrap_or(0);
        let new_total = prior + amount;
        env.storage().persistent().set(&pledge_key, &new_total);

        if prior == 0 {
            let mut backers: Vec<Address> = env
                .storage()
                .instance()
                .get(&DataKey::Backers)
                .unwrap_or_else(|| Vec::new(&env));
            backers.push_back(backer.clone());
            env.storage().instance().set(&DataKey::Backers, &backers);
        }

        let total_pledged: i128 = env.storage().instance().get(&DataKey::TotalPledged).unwrap();
        let updated_total = total_pledged + amount;
        env.storage().instance().set(&DataKey::TotalPledged, &updated_total);

        env.events().publish(
            (Symbol::new(&env, "pledge_made"),),
            (backer, amount, updated_total),
        );

        log!(&env, "escrow: pledge accepted total_pledged={}", updated_total);
        Ok(updated_total)
    }

    /// Arbiter approves a milestone by index, allowing its funds to be released.
    pub fn approve_milestone(env: Env, milestone_index: u32) -> Result<(), EscrowError> {
        let arbiter: Address = env.storage().instance().get(&DataKey::Arbiter).unwrap();
        arbiter.require_auth();

        let mut milestones: Vec<Milestone> =
            env.storage().instance().get(&DataKey::Milestones).unwrap();
        let mut milestone = milestones
            .get(milestone_index)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.approved {
            return Err(EscrowError::MilestoneAlreadyApproved);
        }

        let total_pledged: i128 = env.storage().instance().get(&DataKey::TotalPledged).unwrap();
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        if total_pledged < goal {
            return Err(EscrowError::GoalNotReached);
        }

        milestone.approved = true;
        milestones.set(milestone_index, milestone);
        env.storage().instance().set(&DataKey::Milestones, &milestones);

        env.events().publish(
            (Symbol::new(&env, "milestone_approved"),),
            milestone_index,
        );
        Ok(())
    }

    /// Release the funds for an approved milestone to the campaign creator.
    /// Requires the arbiter's authorization (the same party that approved
    /// the milestone signs off on the actual payout too, so a single stolen
    /// "approve" call can't be replayed by anyone to drain funds early).
    /// Pulls the funds back out of the Vault contract (Escrow -> Vault.withdraw())
    /// and routes them directly to the creator, demonstrating the withdrawal
    /// leg of the inter-contract relationship with a real token payout.
    pub fn release_milestone(env: Env, milestone_index: u32) -> Result<i128, EscrowError> {
        Self::require_initialized(&env)?;

        let arbiter: Address = env.storage().instance().get(&DataKey::Arbiter).unwrap();
        arbiter.require_auth();

        let mut milestones: Vec<Milestone> =
            env.storage().instance().get(&DataKey::Milestones).unwrap();
        let mut milestone = milestones
            .get(milestone_index)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if !milestone.approved {
            return Err(EscrowError::MilestoneNotApproved);
        }
        if milestone.released {
            return Err(EscrowError::MilestoneAlreadyReleased);
        }

        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let release_amount = (goal * milestone.release_bps as i128) / 10_000;

        let vault_address: Address = env.storage().instance().get(&DataKey::VaultAddress).unwrap();
        let vault_client = vault_contract::Client::new(&env, &vault_address);
        let campaign_address = env.current_contract_address();
        let creator: Address = env.storage().instance().get(&DataKey::Creator).unwrap();

        // The Vault's `require_controller` check means this withdraw call
        // must be authorized by this Escrow contract itself, which holds
        // automatically because the call originates from this contract's
        // own invocation context inside Soroban's auth tree. The Vault
        // transfers the real token directly to `creator`.
        vault_client.withdraw(&campaign_address, &creator, &release_amount);

        milestone.released = true;
        milestones.set(milestone_index, milestone);
        env.storage().instance().set(&DataKey::Milestones, &milestones);

        let total_released: i128 = env.storage().instance().get(&DataKey::TotalReleased).unwrap();
        let updated_released = total_released + release_amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalReleased, &updated_released);

        env.events().publish(
            (Symbol::new(&env, "funds_released"),),
            (milestone_index, release_amount, updated_released),
        );

        log!(&env, "escrow: released milestone={} amount={}", milestone_index, release_amount);
        Ok(release_amount)
    }

    /// If the campaign expired without reaching its goal, backers can reclaim
    /// their individual pledge (pulled back out of the Vault with any accrued yield
    /// forfeited to keep accounting simple and safe).
    pub fn refund(env: Env, backer: Address) -> Result<i128, EscrowError> {
        backer.require_auth();
        Self::require_initialized(&env)?;

        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() <= deadline {
            return Err(EscrowError::CampaignNotExpired);
        }

        let total_pledged: i128 = env.storage().instance().get(&DataKey::TotalPledged).unwrap();
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        if total_pledged >= goal {
            return Err(EscrowError::GoalNotReached); // goal was reached; no refunds, only milestone flow
        }

        let pledge_key = DataKey::Pledge(backer.clone());
        let pledged_amount: i128 = env
            .storage()
            .persistent()
            .get(&pledge_key)
            .ok_or(EscrowError::NoPledgeFound)?;

        if pledged_amount <= 0 {
            return Err(EscrowError::NoPledgeFound);
        }

        let vault_address: Address = env.storage().instance().get(&DataKey::VaultAddress).unwrap();
        let vault_client = vault_contract::Client::new(&env, &vault_address);
        let campaign_address = env.current_contract_address();
        vault_client.withdraw(&campaign_address, &backer, &pledged_amount);

        env.storage().persistent().set(&pledge_key, &0i128);

        env.events().publish(
            (Symbol::new(&env, "refund_issued"),),
            (backer, pledged_amount),
        );

        Ok(pledged_amount)
    }

    // ---- read-only views ----

    pub fn get_total_pledged(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalPledged).unwrap_or(0)
    }

    pub fn get_total_released(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalReleased).unwrap_or(0)
    }

    pub fn get_milestones(env: Env) -> Vec<Milestone> {
        env.storage()
            .instance()
            .get(&DataKey::Milestones)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_pledge(env: Env, backer: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Pledge(backer))
            .unwrap_or(0)
    }

    pub fn get_backers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Backers)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_goal(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Goal).unwrap()
    }

    pub fn get_deadline(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap()
    }

    pub fn get_creator(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Creator).unwrap()
    }

    pub fn get_arbiter(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Arbiter).unwrap()
    }

    // ---- internal helpers ----

    fn require_initialized(env: &Env) -> Result<(), EscrowError> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(EscrowError::NotInitialized);
        }
        Ok(())
    }
}
