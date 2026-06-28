#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::Env;

fn advance_time(env: &Env, seconds: u64) {
    let mut info = env.ledger().get();
    info.timestamp += seconds;
    env.ledger().set(info);
}

/// Deploys a test Stellar Asset Contract and mints `amount` to `to`.
fn create_token_and_mint(env: &Env, admin: &Address, to: &Address, amount: i128) -> Address {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();
    let asset_client = StellarAssetClient::new(env, &token_address);
    asset_client.mint(to, &amount);
    token_address
}

struct TestSetup {
    env: Env,
    client: VaultContractClient<'static>,
    token: Address,
    controller: Address,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&env);
    let controller = Address::generate(&env);
    let contract_id = env.register(VaultContract, ());
    let client = VaultContractClient::new(&env, &contract_id);

    // Mint a large supply to the admin; individual tests mint to specific
    // depositors as needed via create_token_and_mint with that same token.
    let token = create_token_and_mint(&env, &admin, &admin, 0);
    client.initialize(&controller, &token);

    TestSetup { env, client, token, controller }
}

fn mint_to(env: &Env, token: &Address, to: &Address, amount: i128) {
    let asset_client = StellarAssetClient::new(env, token);
    asset_client.mint(to, &amount);
}

#[test]
fn test_initialize_sets_controller_and_token() {
    let setup = setup();
    assert_eq!(setup.client.get_controller(), setup.controller);
    assert_eq!(setup.client.get_token(), setup.token);
}

#[test]
fn test_double_initialize_fails() {
    let setup = setup();
    let res = setup.client.try_initialize(&setup.controller, &setup.token);
    assert!(res.is_err());
}

#[test]
fn test_deposit_transfers_real_tokens_into_vault() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let source = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &source, 1_000_000);

    let new_principal = setup.client.deposit(&source, &depositor, &1_000_000);
    assert_eq!(new_principal, 1_000_000);
    assert_eq!(setup.client.balance_of(&depositor), 1_000_000);

    let token_client = TokenClient::new(&setup.env, &setup.token);
    assert_eq!(token_client.balance(&source), 0);
}

#[test]
fn test_deposit_rejects_non_positive_amount() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let source = Address::generate(&setup.env);
    let res = setup.client.try_deposit(&source, &depositor, &0);
    assert!(res.is_err());
}

#[test]
fn test_yield_accrues_over_time() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let source = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &source, 1_000_000);

    setup.client.deposit(&source, &depositor, &1_000_000);
    let before = setup.client.balance_of(&depositor);
    assert_eq!(before, 1_000_000);

    // advance 10 days -> 0.05%/day * 10 days = 0.5% of 1_000_000 = 5_000
    advance_time(&setup.env, 10 * 86_400);
    let after = setup.client.balance_of(&depositor);
    assert_eq!(after, 1_005_000);
}

#[test]
fn test_withdraw_pays_real_tokens_to_recipient() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let source = Address::generate(&setup.env);
    let recipient = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &source, 1_000_000);

    setup.client.deposit(&source, &depositor, &1_000_000);
    advance_time(&setup.env, 10 * 86_400);

    let paid = setup.client.withdraw(&depositor, &recipient, &500_000);
    assert_eq!(paid, 500_000);

    let token_client = TokenClient::new(&setup.env, &setup.token);
    assert_eq!(token_client.balance(&recipient), 500_000);

    // remaining value should be (1_005_000 - 500_000) = 505_000
    assert_eq!(setup.client.balance_of(&depositor), 505_000);
}

#[test]
fn test_withdraw_full_amount_clears_position() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let source = Address::generate(&setup.env);
    let recipient = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &source, 1_000_000);

    setup.client.deposit(&source, &depositor, &1_000_000);
    let paid = setup.client.withdraw(&depositor, &recipient, &1_000_000);
    assert_eq!(paid, 1_000_000);
    assert_eq!(setup.client.balance_of(&depositor), 0);
}

#[test]
fn test_withdraw_more_than_balance_fails() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let source = Address::generate(&setup.env);
    let recipient = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &source, 1_000_000);

    setup.client.deposit(&source, &depositor, &1_000_000);
    let res = setup.client.try_withdraw(&depositor, &recipient, &2_000_000);
    assert!(res.is_err());
}

#[test]
fn test_withdraw_without_position_fails() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let recipient = Address::generate(&setup.env);
    let res = setup.client.try_withdraw(&depositor, &recipient, &100);
    assert!(res.is_err());
}

#[test]
fn test_repeated_deposits_compound_principal() {
    let setup = setup();
    let depositor = Address::generate(&setup.env);
    let source = Address::generate(&setup.env);
    mint_to(&setup.env, &setup.token, &source, 1_500_000);

    setup.client.deposit(&source, &depositor, &1_000_000);
    advance_time(&setup.env, 10 * 86_400); // accrue 5_000
    let new_principal = setup.client.deposit(&source, &depositor, &500_000);

    // 1_000_000 + 5_000 (accrued) + 500_000 = 1_505_000
    assert_eq!(new_principal, 1_505_000);
}
