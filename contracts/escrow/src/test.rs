#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{vec, Env, String};

fn advance_time(env: &Env, seconds: u64) {
    let mut info = env.ledger().get();
    info.timestamp += seconds;
    env.ledger().set(info);
}

fn create_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone()).address()
}

fn mint_to(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

struct TestSetup {
    env: Env,
    escrow: EscrowContractClient<'static>,
    token: Address,
    creator: Address,
    arbiter: Address,
    goal: i128,
    deadline: u64,
}

fn setup(goal: i128) -> TestSetup {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let token_admin = Address::generate(&env);
    let token = create_token(&env, &token_admin);

    // Register the real Vault contract WASM so the Escrow contract's
    // cross-contract calls exercise actual inter-contract communication,
    // not a mock.
    let vault_id = env.register(vault_contract::WASM, ());
    let vault_client = vault_contract::Client::new(&env, &vault_id);

    let creator = Address::generate(&env);
    let arbiter = Address::generate(&env);

    let escrow_id = env.register(EscrowContract, ());
    let escrow = EscrowContractClient::new(&env, &escrow_id);

    // The vault's controller must be the escrow contract's own address so
    // that the escrow's cross-contract calls are authorized.
    vault_client.initialize(&escrow_id, &token);

    let deadline = env.ledger().timestamp() + 30 * 86_400;
    let milestones = vec![
        &env,
        (String::from_str(&env, "Prototype complete"), 4_000u32),
        (String::from_str(&env, "Beta launch"), 3_000u32),
        (String::from_str(&env, "Public release"), 3_000u32),
    ];

    escrow.initialize(&creator, &arbiter, &vault_id, &goal, &deadline, &milestones);

    TestSetup {
        env,
        escrow,
        token,
        creator,
        arbiter,
        goal,
        deadline,
    }
}

#[test]
fn test_initialize_rejects_bad_milestone_bps() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token = create_token(&env, &admin);
    let vault_id = env.register(vault_contract::WASM, ());
    let creator = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let escrow_id = env.register(EscrowContract, ());
    let escrow = EscrowContractClient::new(&env, &escrow_id);

    let deadline = env.ledger().timestamp() + 1000;
    // bps sums to 9000, not 10000 -> should fail
    let milestones = vec![&env, (String::from_str(&env, "Only one"), 9_000u32)];

    let res = escrow.try_initialize(&creator, &arbiter, &vault_id, &1000, &deadline, &milestones);
    assert!(res.is_err());
    let _ = token; // unused in this particular test, kept for setup symmetry
}

#[test]
fn test_pledge_forwards_real_tokens_to_vault_via_cross_contract_call() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 400_000);

    let total = setup.escrow.pledge(&backer, &400_000);
    assert_eq!(total, 400_000);
    assert_eq!(setup.escrow.get_total_pledged(), 400_000);
    assert_eq!(setup.escrow.get_pledge(&backer), 400_000);

    let token_client = TokenClient::new(&setup.env, &setup.token);
    assert_eq!(token_client.balance(&backer), 0);
}

#[test]
fn test_multiple_backers_accumulate() {
    let setup = setup(1_000_000);
    let alice = Address::generate(&setup.env);
    let bob = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &alice, 300_000);
    mint_to(&setup.env, &setup.token, &bob, 200_000);

    setup.escrow.pledge(&alice, &300_000);
    setup.escrow.pledge(&bob, &200_000);

    assert_eq!(setup.escrow.get_total_pledged(), 500_000);
    assert_eq!(setup.escrow.get_backers().len(), 2);
}

#[test]
fn test_pledge_after_deadline_fails() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 100_000);
    advance_time(&setup.env, 31 * 86_400);

    let res = setup.escrow.try_pledge(&backer, &100_000);
    assert!(res.is_err());
}

#[test]
fn test_approve_milestone_requires_goal_reached() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 500_000);
    setup.escrow.pledge(&backer, &500_000); // under goal

    let res = setup.escrow.try_approve_milestone(&0);
    assert!(res.is_err());
}

#[test]
fn test_full_milestone_lifecycle_releases_real_tokens_to_creator() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 1_000_000);
    setup.escrow.pledge(&backer, &1_000_000); // goal reached

    setup.escrow.approve_milestone(&0);
    let released = setup.escrow.release_milestone(&0);

    // milestone 0 = 4000 bps of 1_000_000 = 400_000
    assert_eq!(released, 400_000);
    assert_eq!(setup.escrow.get_total_released(), 400_000);

    let milestones = setup.escrow.get_milestones();
    let m0 = milestones.get(0).unwrap();
    assert!(m0.approved);
    assert!(m0.released);

    let token_client = TokenClient::new(&setup.env, &setup.token);
    assert_eq!(token_client.balance(&setup.creator), 400_000);
}

#[test]
fn test_cannot_release_unapproved_milestone() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 1_000_000);
    setup.escrow.pledge(&backer, &1_000_000);

    let res = setup.escrow.try_release_milestone(&0);
    assert!(res.is_err());
}

#[test]
fn test_cannot_double_release_milestone() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 1_000_000);
    setup.escrow.pledge(&backer, &1_000_000);

    setup.escrow.approve_milestone(&0);
    setup.escrow.release_milestone(&0);

    let res = setup.escrow.try_release_milestone(&0);
    assert!(res.is_err());
}

#[test]
fn test_refund_after_expired_campaign_below_goal() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 200_000);
    setup.escrow.pledge(&backer, &200_000); // below goal

    advance_time(&setup.env, 31 * 86_400); // pass deadline

    let refunded = setup.escrow.refund(&backer);
    assert_eq!(refunded, 200_000);
    assert_eq!(setup.escrow.get_pledge(&backer), 0);

    let token_client = TokenClient::new(&setup.env, &setup.token);
    assert_eq!(token_client.balance(&backer), 200_000);
}

#[test]
fn test_refund_blocked_before_deadline() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 200_000);
    setup.escrow.pledge(&backer, &200_000);

    let res = setup.escrow.try_refund(&backer);
    assert!(res.is_err());
}

#[test]
fn test_refund_blocked_if_goal_was_reached() {
    let setup = setup(1_000_000);
    let backer = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &backer, 1_000_000);
    setup.escrow.pledge(&backer, &1_000_000);

    advance_time(&setup.env, 31 * 86_400);

    let res = setup.escrow.try_refund(&backer);
    assert!(res.is_err());
}

#[test]
fn test_getters_reflect_initialized_state() {
    let setup = setup(1_000_000);
    assert_eq!(setup.escrow.get_goal(), setup.goal);
    assert_eq!(setup.escrow.get_deadline(), setup.deadline);
    assert_eq!(setup.escrow.get_creator(), setup.creator);
    let _ = &setup.arbiter; // referenced for clarity of setup contents
}
