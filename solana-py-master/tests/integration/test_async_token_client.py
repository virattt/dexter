# pylint: disable=R0401
"""Tests for the SPL Token Client."""

import pytest
import spl.token._layouts as layouts
from solders.pubkey import Pubkey
from spl.token.async_client import AsyncToken
from spl.token.constants import ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID

from ..utils import AIRDROP_AMOUNT, OPTS, assert_valid_response


@pytest.mark.integration
@pytest.fixture(scope="module")
async def test_token(stubbed_sender, freeze_authority, test_http_client_async) -> AsyncToken:
    """Test create mint."""
    resp = await test_http_client_async.request_airdrop(stubbed_sender.pubkey(), AIRDROP_AMOUNT)
    await test_http_client_async.confirm_transaction(resp.value)
    assert_valid_response(resp)

    expected_decimals = 6
    token_client = await AsyncToken.create_mint(
        test_http_client_async,
        stubbed_sender,
        stubbed_sender.pubkey(),
        expected_decimals,
        TOKEN_PROGRAM_ID,
        freeze_authority.pubkey(),
    )

    assert token_client.pubkey
    assert token_client.program_id == TOKEN_PROGRAM_ID
    assert token_client.payer.pubkey() == stubbed_sender.pubkey()

    resp = await test_http_client_async.get_account_info(token_client.pubkey)
    assert_valid_response(resp)
    assert resp.value.owner == TOKEN_PROGRAM_ID

    mint_data = layouts.MINT_LAYOUT.parse(resp.value.data)
    assert mint_data.is_initialized
    assert mint_data.decimals == expected_decimals
    assert mint_data.supply == 0
    assert Pubkey(mint_data.mint_authority) == stubbed_sender.pubkey()
    assert Pubkey(mint_data.freeze_authority) == freeze_authority.pubkey()
    return token_client


@pytest.mark.integration
@pytest.fixture(scope="module")
async def stubbed_sender_token_account_pk(stubbed_sender, test_token) -> Pubkey:  # pylint: disable=redefined-outer-name
    """Token account for stubbed sender."""
    return await test_token.create_account(stubbed_sender.pubkey())


@pytest.mark.integration
@pytest.fixture(scope="module")
async def async_stubbed_receiver_token_account_pk(
    async_stubbed_receiver,
    test_token,  # pylint: disable=redefined-outer-name
) -> Pubkey:
    """Token account for stubbed receiver."""
    return await test_token.create_account(async_stubbed_receiver)


@pytest.mark.integration
async def test_new_account(stubbed_sender, test_http_client_async, test_token):  # pylint: disable=redefined-outer-name
    """Test creating a new token account."""
    token_account_pk = await test_token.create_account(stubbed_sender.pubkey())
    resp = await test_http_client_async.get_account_info(token_account_pk)
    assert_valid_response(resp)
    assert resp.value.owner == TOKEN_PROGRAM_ID

    account_data = layouts.ACCOUNT_LAYOUT.parse(resp.value.data)
    assert account_data.state
    assert not account_data.amount
    assert (
        not account_data.delegate_option
        and not account_data.delegated_amount
        and Pubkey(account_data.delegate) == Pubkey([0] * 31 + [0])
    )
    assert not account_data.close_authority_option and Pubkey(account_data.close_authority) == Pubkey([0] * 31 + [0])
    assert not account_data.is_native_option and not account_data.is_native
    assert Pubkey(account_data.mint) == test_token.pubkey
    assert Pubkey(account_data.owner) == stubbed_sender.pubkey()


@pytest.mark.integration
async def test_new_associated_account(test_token):  # pylint: disable=redefined-outer-name
    """Test creating a new associated token account."""
    new_acct = Pubkey([0] * 31 + [0])
    token_account_pubkey = await test_token.create_associated_token_account(new_acct)
    expected_token_account_key, _ = new_acct.find_program_address(
        seeds=[bytes(new_acct), bytes(TOKEN_PROGRAM_ID), bytes(test_token.pubkey)],
        program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    assert token_account_pubkey == expected_token_account_key


@pytest.mark.integration
async def test_get_account_info(stubbed_sender, stubbed_sender_token_account_pk, test_token):  # pylint: disable=redefined-outer-name
    """Test get token account info."""
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.is_initialized is True
    assert account_info.mint == test_token.pubkey
    assert account_info.owner == stubbed_sender.pubkey()
    assert account_info.amount == 0
    assert account_info.delegate is None
    assert account_info.delegated_amount == 0
    assert account_info.is_frozen is False
    assert account_info.is_native is False
    assert account_info.rent_exempt_reserve is None
    assert account_info.close_authority is None


@pytest.mark.integration
async def test_get_mint_info(stubbed_sender, freeze_authority, test_token):  # pylint: disable=redefined-outer-name
    """Test get token mint info."""
    mint_info = await test_token.get_mint_info()
    assert mint_info.mint_authority == stubbed_sender.pubkey()
    assert mint_info.supply == 0
    assert mint_info.decimals == 6
    assert mint_info.is_initialized is True
    assert mint_info.freeze_authority == freeze_authority.pubkey()


@pytest.mark.integration
async def test_mint_to(stubbed_sender, stubbed_sender_token_account_pk, test_token):  # pylint: disable=redefined-outer-name
    """Test mint token to account and get balance."""
    expected_amount = 1000
    resp = await test_token.mint_to(
        dest=stubbed_sender_token_account_pk,
        mint_authority=stubbed_sender,
        amount=1000,
        opts=OPTS,
    )
    assert_valid_response(resp)
    resp = await test_token.get_balance(stubbed_sender_token_account_pk)
    balance_info = resp.value
    assert balance_info.amount == str(expected_amount)
    assert balance_info.decimals == 6
    assert balance_info.ui_amount == 0.001


@pytest.mark.integration
async def test_transfer(
    stubbed_sender, async_stubbed_receiver_token_account_pk, stubbed_sender_token_account_pk, test_token
):  # pylint: disable=redefined-outer-name
    """Test token transfer."""
    expected_amount = 500
    resp = await test_token.transfer(
        source=stubbed_sender_token_account_pk,
        dest=async_stubbed_receiver_token_account_pk,
        owner=stubbed_sender,
        amount=expected_amount,
        opts=OPTS,
    )
    assert_valid_response(resp)
    resp = await test_token.get_balance(async_stubbed_receiver_token_account_pk)
    balance_info = resp.value
    assert balance_info.amount == str(expected_amount)
    assert balance_info.decimals == 6
    assert balance_info.ui_amount == 0.0005


@pytest.mark.integration
async def test_burn(stubbed_sender, stubbed_sender_token_account_pk, test_token):  # pylint: disable=redefined-outer-name
    """Test burning tokens."""
    burn_amount = 200
    expected_amount = 300

    burn_resp = await test_token.burn(
        account=stubbed_sender_token_account_pk,
        owner=stubbed_sender,
        amount=burn_amount,
        multi_signers=None,
        opts=OPTS,
    )
    assert_valid_response(burn_resp)

    resp = await test_token.get_balance(stubbed_sender_token_account_pk)
    balance_info = resp.value
    assert balance_info.amount == str(expected_amount)
    assert balance_info.decimals == 6
    assert balance_info.ui_amount == 0.0003


@pytest.mark.integration
async def test_mint_to_checked(
    stubbed_sender,
    stubbed_sender_token_account_pk,
    test_token,
):  # pylint: disable=redefined-outer-name
    """Test mint token checked and get balance."""
    expected_amount = 1000
    mint_amount = 700
    expected_decimals = 6

    mint_resp = await test_token.mint_to_checked(
        dest=stubbed_sender_token_account_pk,
        mint_authority=stubbed_sender,
        amount=mint_amount,
        decimals=expected_decimals,
        multi_signers=None,
        opts=OPTS,
    )
    assert_valid_response(mint_resp)

    resp = await test_token.get_balance(stubbed_sender_token_account_pk)
    balance_info = resp.value
    assert balance_info.amount == str(expected_amount)
    assert balance_info.decimals == expected_decimals
    assert balance_info.ui_amount == 0.001


@pytest.mark.integration
async def test_transfer_checked(
    stubbed_sender, async_stubbed_receiver_token_account_pk, stubbed_sender_token_account_pk, test_token
):  # pylint: disable=redefined-outer-name
    """Test token transfer."""
    transfer_amount = 500
    total_amount = 1000
    expected_decimals = 6

    transfer_resp = await test_token.transfer_checked(
        source=stubbed_sender_token_account_pk,
        dest=async_stubbed_receiver_token_account_pk,
        owner=stubbed_sender,
        amount=transfer_amount,
        decimals=expected_decimals,
        multi_signers=None,
        opts=OPTS,
    )
    assert_valid_response(transfer_resp)

    resp = await test_token.get_balance(async_stubbed_receiver_token_account_pk)
    balance_info = resp.value
    assert balance_info.amount == str(total_amount)
    assert balance_info.decimals == expected_decimals
    assert balance_info.ui_amount == 0.001


@pytest.mark.integration
async def test_burn_checked(stubbed_sender, stubbed_sender_token_account_pk, test_token):  # pylint: disable=redefined-outer-name
    """Test burning tokens checked."""
    burn_amount = 500
    expected_decimals = 6

    burn_resp = await test_token.burn_checked(
        account=stubbed_sender_token_account_pk,
        owner=stubbed_sender,
        amount=burn_amount,
        decimals=expected_decimals,
        multi_signers=None,
        opts=OPTS,
    )
    assert_valid_response(burn_resp)

    resp = await test_token.get_balance(stubbed_sender_token_account_pk)
    balance_info = resp.value
    assert balance_info.amount == str(0)
    assert balance_info.decimals == expected_decimals
    assert balance_info.ui_amount == 0.0


@pytest.mark.integration
async def test_get_accounts(stubbed_sender, test_token):  # pylint: disable=redefined-outer-name
    """Test get token accounts."""
    resp = await test_token.get_accounts_by_owner_json_parsed(stubbed_sender.pubkey())
    assert_valid_response(resp)
    assert len(resp.value) == 2
    for resp_data in resp.value:
        assert resp_data.pubkey
        parsed_data = resp_data.account.data.parsed["info"]
        assert parsed_data["owner"] == str(stubbed_sender.pubkey())


@pytest.mark.integration
async def test_approve(
    stubbed_sender,
    async_stubbed_receiver,
    stubbed_sender_token_account_pk,
    test_token,
    test_http_client_async,
):  # pylint: disable=redefined-outer-name
    """Test approval for delgating a token account."""
    expected_amount_delegated = 500
    resp = await test_token.approve(
        source=stubbed_sender_token_account_pk,
        delegate=async_stubbed_receiver,
        owner=stubbed_sender.pubkey(),
        amount=expected_amount_delegated,
        opts=OPTS,
    )
    await test_http_client_async.confirm_transaction(resp.value)
    assert_valid_response(resp)
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.delegate == async_stubbed_receiver
    assert account_info.delegated_amount == expected_amount_delegated


@pytest.mark.integration
async def test_revoke(
    stubbed_sender,
    async_stubbed_receiver,
    stubbed_sender_token_account_pk,
    test_token,
    test_http_client_async,
):  # pylint: disable=redefined-outer-name
    """Test revoke for undelgating a token account."""
    expected_amount_delegated = 500
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.delegate == async_stubbed_receiver
    assert account_info.delegated_amount == expected_amount_delegated

    revoke_resp = await test_token.revoke(
        account=stubbed_sender_token_account_pk, owner=stubbed_sender.pubkey(), opts=OPTS
    )
    await test_http_client_async.confirm_transaction(revoke_resp.value)
    assert_valid_response(revoke_resp)
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.delegate is None
    assert account_info.delegated_amount == 0


@pytest.mark.integration
async def test_approve_checked(
    stubbed_sender,
    async_stubbed_receiver,
    stubbed_sender_token_account_pk,
    test_token,
    test_http_client_async,
):  # pylint: disable=redefined-outer-name
    """Test approve_checked for delegating a token account."""
    expected_amount_delegated = 500
    resp = await test_token.approve_checked(
        source=stubbed_sender_token_account_pk,
        delegate=async_stubbed_receiver,
        owner=stubbed_sender.pubkey(),
        amount=expected_amount_delegated,
        decimals=6,
        opts=OPTS,
    )
    await test_http_client_async.confirm_transaction(resp.value)
    assert_valid_response(resp)
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.delegate == async_stubbed_receiver
    assert account_info.delegated_amount == expected_amount_delegated


@pytest.mark.integration
async def test_freeze_account(stubbed_sender_token_account_pk, freeze_authority, test_token, test_http_client_async):  # pylint: disable=redefined-outer-name
    """Test freezing an account."""
    resp = await test_http_client_async.request_airdrop(freeze_authority.pubkey(), AIRDROP_AMOUNT)
    await test_http_client_async.confirm_transaction(resp.value)
    assert_valid_response(resp)

    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.is_frozen is False

    freeze_resp = await test_token.freeze_account(stubbed_sender_token_account_pk, freeze_authority, opts=OPTS)
    await test_http_client_async.confirm_transaction(freeze_resp.value)
    assert_valid_response(freeze_resp)
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.is_frozen is True


@pytest.mark.integration
async def test_thaw_account(stubbed_sender_token_account_pk, freeze_authority, test_token, test_http_client_async):  # pylint: disable=redefined-outer-name
    """Test thawing an account."""
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.is_frozen is True

    thaw_resp = await test_token.thaw_account(stubbed_sender_token_account_pk, freeze_authority, opts=OPTS)
    await test_http_client_async.confirm_transaction(thaw_resp.value)
    assert_valid_response(thaw_resp)
    account_info = await test_token.get_account_info(stubbed_sender_token_account_pk)
    assert account_info.is_frozen is False


@pytest.mark.integration
async def test_close_account(
    stubbed_sender,
    stubbed_sender_token_account_pk,
    async_stubbed_receiver_token_account_pk,
    test_token,
    test_http_client_async,
):  # pylint: disable=redefined-outer-name
    """Test closing a token account."""
    create_resp = await test_http_client_async.get_account_info(stubbed_sender_token_account_pk)
    assert_valid_response(create_resp)
    assert create_resp.value.data

    close_resp = await test_token.close_account(
        account=stubbed_sender_token_account_pk,
        dest=async_stubbed_receiver_token_account_pk,
        authority=stubbed_sender,
        opts=OPTS,
    )
    await test_http_client_async.confirm_transaction(close_resp.value)
    assert_valid_response(close_resp)

    info_resp = await test_http_client_async.get_account_info(stubbed_sender_token_account_pk)
    assert_valid_response(info_resp)
    assert info_resp.value is None


@pytest.mark.integration
async def test_create_multisig(stubbed_sender, async_stubbed_receiver, test_token, test_http_client):  # pylint: disable=redefined-outer-name
    """Test creating a multisig account."""
    min_signers = 2
    multisig_pubkey = await test_token.create_multisig(
        min_signers, [stubbed_sender.pubkey(), async_stubbed_receiver], opts=OPTS
    )
    resp = test_http_client.get_account_info(multisig_pubkey)
    assert_valid_response(resp)
    assert resp.value.owner == TOKEN_PROGRAM_ID

    multisig_data = layouts.MULTISIG_LAYOUT.parse(resp.value.data)
    assert multisig_data.is_initialized
    assert multisig_data.m == min_signers
    assert Pubkey(multisig_data.signer1) == stubbed_sender.pubkey()
    assert Pubkey(multisig_data.signer2) == async_stubbed_receiver
