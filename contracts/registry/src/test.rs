#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{vec, Env, String};

fn create_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone()).address()
}

fn mint_to(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

struct TestSetup {
    env: Env,
    registry: RegistryContractClient<'static>,
    escrow_id: Address,
    token: Address,
    creator: Address,
}

fn setup_with_campaign(goal: i128) -> TestSetup {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let token_admin = Address::generate(&env);
    let token = create_token(&env, &token_admin);

    // Deploy the real Vault and Escrow contracts so the Registry's
    // cross-contract call in `campaign_status` exercises the genuine
    // Registry -> Escrow -> Vault chain end-to-end.
    let vault_id = env.register(vault::VaultContract, ());
    let vault_client = vault::VaultContractClient::new(&env, &vault_id);

    let escrow_id = env.register(escrow::EscrowContract, ());
    let escrow_client = escrow::EscrowContractClient::new(&env, &escrow_id);

    vault_client.initialize(&escrow_id, &token);

    let creator = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let deadline = env.ledger().timestamp() + 30 * 86_400;
    let milestones = vec![
        &env,
        (String::from_str(&env, "Milestone A"), 5_000u32),
        (String::from_str(&env, "Milestone B"), 5_000u32),
    ];
    escrow_client.initialize(&creator, &arbiter, &vault_id, &goal, &deadline, &milestones);

    let registry_id = env.register(RegistryContract, ());
    let registry = RegistryContractClient::new(&env, &registry_id);

    registry.register_campaign(
        &creator,
        &String::from_str(&env, "Solar Lantern for Rural Schools"),
        &String::from_str(&env, "Education"),
        &escrow_id,
    );

    TestSetup {
        env,
        registry,
        escrow_id,
        token,
        creator,
    }
}

#[test]
fn test_register_campaign_assigns_sequential_ids() {
    let setup = setup_with_campaign(1_000_000);
    let env = &setup.env;

    let meta = setup.registry.get_campaign(&0);
    assert_eq!(meta.id, 0);
    assert_eq!(meta.creator, setup.creator);
    assert_eq!(meta.escrow_address, setup.escrow_id);
    assert_eq!(meta.title, String::from_str(env, "Solar Lantern for Rural Schools"));
}

#[test]
fn test_register_rejects_empty_title() {
    let setup = setup_with_campaign(1_000_000);
    let env = &setup.env;
    let res = setup.registry.try_register_campaign(
        &setup.creator,
        &String::from_str(env, ""),
        &String::from_str(env, "Tech"),
        &setup.escrow_id,
    );
    assert!(res.is_err());
}

#[test]
fn test_get_unknown_campaign_fails() {
    let setup = setup_with_campaign(1_000_000);
    let res = setup.registry.try_get_campaign(&999);
    assert!(res.is_err());
}

#[test]
fn test_list_campaign_ids_grows() {
    let setup = setup_with_campaign(1_000_000);
    let env = &setup.env;

    setup.registry.register_campaign(
        &setup.creator,
        &String::from_str(env, "Second Campaign"),
        &String::from_str(env, "Tech"),
        &setup.escrow_id,
    );

    let ids = setup.registry.list_campaign_ids();
    assert_eq!(ids.len(), 2);
    assert_eq!(setup.registry.total_campaigns(), 2);
}

#[test]
fn test_campaign_status_cross_calls_live_escrow_state() {
    let setup = setup_with_campaign(1_000_000);
    let env = &setup.env;

    let escrow_client = escrow::EscrowContractClient::new(env, &setup.escrow_id);
    let backer = Address::generate(env);
    mint_to(env, &setup.token, &backer, 600_000);
    escrow_client.pledge(&backer, &600_000);

    // Registry.campaign_status() performs the cross-contract call into the
    // Escrow contract to read the *live* pledged total -- this is the
    // assertion that proves Registry -> Escrow inter-contract communication
    // actually works end-to-end, not just that both contracts compile.
    let status = setup.registry.campaign_status(&0);
    assert_eq!(status.total_pledged, 600_000);
    assert_eq!(status.goal, 1_000_000);
    assert_eq!(status.meta.creator, setup.creator);
}

#[test]
fn test_campaign_status_unknown_id_fails() {
    let setup = setup_with_campaign(1_000_000);
    let res = setup.registry.try_campaign_status(&42);
    assert!(res.is_err());
}
