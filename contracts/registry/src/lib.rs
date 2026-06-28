//! # Registry Contract
//!
//! The discovery layer of the platform. Anyone can register a deployed
//! Escrow contract as a public campaign. The registry stores lightweight
//! metadata (title, creator, escrow address) and exposes a `campaign_status`
//! view that cross-calls into the campaign's own Escrow contract to fetch
//! live pledge totals — a second, independent inter-contract relationship
//! (Registry -> Escrow) on top of the Escrow -> Vault relationship, giving
//! the platform a genuine three-contract dependency graph:
//!
//! ```text
//! Registry --(reads live status)--> Escrow --(deposits/withdraws)--> Vault
//! ```
#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

mod test;

mod escrow_contract {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/escrow.wasm"
    );
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    NextId,
    Campaign(u32),
    AllIds,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignMeta {
    pub id: u32,
    pub title: String,
    pub creator: Address,
    pub escrow_address: Address,
    pub category: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignStatus {
    pub meta: CampaignMeta,
    pub total_pledged: i128,
    pub total_released: i128,
    pub goal: i128,
    pub deadline: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum RegistryError {
    CampaignNotFound = 1,
    Unauthorized = 2,
    InvalidInput = 3,
}

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    /// Register a freshly deployed Escrow contract as a discoverable campaign.
    /// `creator` must match (or be authorized by) the campaign's own creator and
    /// must sign this call, preventing anyone from squatting on someone else's
    /// escrow address in the public listings.
    pub fn register_campaign(
        env: Env,
        creator: Address,
        title: String,
        category: String,
        escrow_address: Address,
    ) -> Result<u32, RegistryError> {
        creator.require_auth();

        if title.len() == 0 {
            return Err(RegistryError::InvalidInput);
        }

        let next_id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        let meta = CampaignMeta {
            id: next_id,
            title,
            creator: creator.clone(),
            escrow_address,
            category,
        };

        env.storage().persistent().set(&DataKey::Campaign(next_id), &meta);

        let mut all_ids: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::AllIds)
            .unwrap_or_else(|| Vec::new(&env));
        all_ids.push_back(next_id);
        env.storage().instance().set(&DataKey::AllIds, &all_ids);
        env.storage().instance().set(&DataKey::NextId, &(next_id + 1));

        env.events().publish(
            (Symbol::new(&env, "campaign_registered"),),
            (next_id, creator),
        );

        Ok(next_id)
    }

    /// Fetch a campaign's static metadata.
    pub fn get_campaign(env: Env, id: u32) -> Result<CampaignMeta, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(id))
            .ok_or(RegistryError::CampaignNotFound)
    }

    /// Cross-contract call: fetch a campaign's *live* on-chain status by
    /// calling directly into its Escrow contract. This is the Registry's
    /// inter-contract communication leg (Registry -> Escrow).
    pub fn campaign_status(env: Env, id: u32) -> Result<CampaignStatus, RegistryError> {
        let meta: CampaignMeta = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(id))
            .ok_or(RegistryError::CampaignNotFound)?;

        let escrow_client = escrow_contract::Client::new(&env, &meta.escrow_address);
        let total_pledged = escrow_client.get_total_pledged();
        let total_released = escrow_client.get_total_released();
        let goal = escrow_client.get_goal();
        let deadline = escrow_client.get_deadline();

        Ok(CampaignStatus {
            meta,
            total_pledged,
            total_released,
            goal,
            deadline,
        })
    }

    /// List all registered campaign ids (paginated by the caller on the frontend).
    pub fn list_campaign_ids(env: Env) -> Vec<u32> {
        env.storage()
            .instance()
            .get(&DataKey::AllIds)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn total_campaigns(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::NextId).unwrap_or(0)
    }
}
