"""Tests for the HTTP API Client."""

from typing import Tuple

import pytest
import solders.system_program as sp
from solders.keypair import Keypair
from solders.message import MessageV0, Message
from solders.pubkey import Pubkey
from solders.rpc.errors import SendTransactionPreflightFailureMessage
from solders.rpc.requests import GetBlockHeight, GetFirstAvailableBlock
from solders.rpc.responses import GetBlockHeightResp, GetFirstAvailableBlockResp, Resp
from solders.transaction import VersionedTransaction
from spl.token.constants import WRAPPED_SOL_MINT

from solana.constants import VOTE_PROGRAM_ID
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed, Finalized, Processed
from solana.rpc.core import RPCException, TransactionExpiredBlockheightExceededError
from solana.rpc.types import DataSliceOpts, TxOpts
from solders.transaction import Transaction

from ..utils import AIRDROP_AMOUNT, assert_valid_response


@pytest.mark.integration
async def test_request_air_drop(
    async_stubbed_sender: Keypair, async_stubbed_receiver: Pubkey, test_http_client_async: AsyncClient
):
    """Test air drop to async_stubbed_sender and async_stubbed_receiver."""
    # Airdrop to stubbed_sender
    resp = await test_http_client_async.request_airdrop(async_stubbed_sender.pubkey(), AIRDROP_AMOUNT)
    assert_valid_response(resp)
    await test_http_client_async.confirm_transaction(resp.value)
    balance = await test_http_client_async.get_balance(async_stubbed_sender.pubkey())
    assert balance.value == AIRDROP_AMOUNT
    # Airdrop to stubbed_receiver
    resp = await test_http_client_async.request_airdrop(async_stubbed_receiver, AIRDROP_AMOUNT)
    assert_valid_response(resp)
    await test_http_client_async.confirm_transaction(resp.value)
    balance = await test_http_client_async.get_balance(async_stubbed_receiver)
    assert balance.value == AIRDROP_AMOUNT


@pytest.mark.integration
async def test_request_air_drop_prefetched_blockhash(
    async_stubbed_sender_prefetched_blockhash, async_stubbed_receiver_prefetched_blockhash, test_http_client_async
):
    """Test air drop to async_stubbed_sender and async_stubbed_receiver."""
    # Airdrop to stubbed_sender
    resp = await test_http_client_async.request_airdrop(
        async_stubbed_sender_prefetched_blockhash.pubkey(), AIRDROP_AMOUNT
    )
    assert_valid_response(resp)
    await test_http_client_async.confirm_transaction(resp.value)
    balance = await test_http_client_async.get_balance(async_stubbed_sender_prefetched_blockhash.pubkey())
    assert balance.value == AIRDROP_AMOUNT
    # Airdrop to stubbed_receiver
    resp = await test_http_client_async.request_airdrop(async_stubbed_receiver_prefetched_blockhash, AIRDROP_AMOUNT)
    assert_valid_response(resp)
    await test_http_client_async.confirm_transaction(resp.value)
    balance = await test_http_client_async.get_balance(async_stubbed_receiver_prefetched_blockhash)
    assert balance.value == AIRDROP_AMOUNT


@pytest.mark.integration
async def test_send_transaction_and_get_balance(
    async_stubbed_sender: Keypair, async_stubbed_receiver: Pubkey, test_http_client_async: AsyncClient
):
    """Test sending a transaction to localnet."""
    # Create transfer tx to transfer lamports from stubbed sender to async_stubbed_receiver
    ixs = [
        sp.transfer(
            sp.TransferParams(
                from_pubkey=async_stubbed_sender.pubkey(), to_pubkey=async_stubbed_receiver, lamports=1000
            )
        )
    ]
    blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    msg = Message.new_with_blockhash(ixs, async_stubbed_sender.pubkey(), blockhash)
    transfer_tx = Transaction([async_stubbed_sender], msg, blockhash)
    resp = await test_http_client_async.send_transaction(transfer_tx)
    assert_valid_response(resp)
    # Confirm transaction
    await test_http_client_async.confirm_transaction(resp.value)
    # Check balances
    sender_balance_resp = await test_http_client_async.get_balance(async_stubbed_sender.pubkey())
    assert_valid_response(sender_balance_resp)
    assert sender_balance_resp.value == 9999994000
    receiver_balance_resp = await test_http_client_async.get_balance(async_stubbed_receiver)
    assert_valid_response(receiver_balance_resp)
    assert receiver_balance_resp.value == 10000001000


@pytest.mark.integration
async def test_send_versioned_transaction_and_get_balance(
    random_funded_keypair: Keypair, test_http_client_async: AsyncClient
):
    """Test sending a transaction to localnet."""
    receiver = Keypair()
    amount = 1_000_000
    transfer_ix = sp.transfer(
        sp.TransferParams(from_pubkey=random_funded_keypair.pubkey(), to_pubkey=receiver.pubkey(), lamports=amount)
    )
    recent_blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    msg = MessageV0.try_compile(
        payer=random_funded_keypair.pubkey(),
        instructions=[transfer_ix],
        address_lookup_table_accounts=[],
        recent_blockhash=recent_blockhash,
    )
    transfer_tx = VersionedTransaction(msg, [random_funded_keypair])
    sim_resp = await test_http_client_async.simulate_transaction(transfer_tx)
    assert_valid_response(sim_resp)
    resp = await test_http_client_async.send_transaction(transfer_tx)
    assert_valid_response(resp)
    # Confirm transaction
    await test_http_client_async.confirm_transaction(resp.value)
    # Check balances
    sender_balance_resp = await test_http_client_async.get_balance(random_funded_keypair.pubkey())
    assert_valid_response(sender_balance_resp)
    assert sender_balance_resp.value == AIRDROP_AMOUNT - amount - 5000
    receiver_balance_resp = await test_http_client_async.get_balance(receiver.pubkey())
    assert_valid_response(receiver_balance_resp)
    assert receiver_balance_resp.value == amount


@pytest.mark.integration
async def test_send_bad_transaction(stubbed_receiver: Pubkey, test_http_client_async: AsyncClient):
    """Test sending a transaction that errors."""
    poor_account = Keypair()
    airdrop_amount = 1000000
    airdrop_resp = await test_http_client_async.request_airdrop(poor_account.pubkey(), airdrop_amount)
    assert_valid_response(airdrop_resp)
    await test_http_client_async.confirm_transaction(airdrop_resp.value)
    balance = await test_http_client_async.get_balance(poor_account.pubkey())
    assert balance.value == airdrop_amount
    # Create transfer tx to transfer lamports from stubbed sender to stubbed_receiver
    blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    ixs = [
        sp.transfer(
            sp.TransferParams(
                from_pubkey=poor_account.pubkey(), to_pubkey=stubbed_receiver, lamports=airdrop_amount + 1
            )
        )
    ]
    msg = Message.new_with_blockhash(ixs, poor_account.pubkey(), blockhash)
    transfer_tx = Transaction([poor_account], msg, blockhash)
    with pytest.raises(RPCException) as exc_info:
        await test_http_client_async.send_transaction(transfer_tx)
    err = exc_info.value.args[0]
    assert isinstance(err, SendTransactionPreflightFailureMessage)
    assert err.data.logs


@pytest.mark.integration
async def test_send_transaction_prefetched_blockhash(
    async_stubbed_sender_prefetched_blockhash, async_stubbed_receiver_prefetched_blockhash, test_http_client_async
):
    """Test sending a transaction to localnet."""
    # Create transfer tx to transfer lamports from stubbed sender to async_stubbed_receiver
    blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    ixs = [
        sp.transfer(
            sp.TransferParams(
                from_pubkey=async_stubbed_sender_prefetched_blockhash.pubkey(),
                to_pubkey=async_stubbed_receiver_prefetched_blockhash,
                lamports=1000,
            )
        )
    ]
    msg = Message.new_with_blockhash(ixs, async_stubbed_sender_prefetched_blockhash.pubkey(), blockhash)
    transfer_tx = Transaction([async_stubbed_sender_prefetched_blockhash], msg, blockhash)
    resp = await test_http_client_async.send_transaction(transfer_tx)
    assert_valid_response(resp)
    # Confirm transaction
    await test_http_client_async.confirm_transaction(resp.value)
    # Check balances
    resp = await test_http_client_async.get_balance(async_stubbed_sender_prefetched_blockhash.pubkey())
    assert_valid_response(resp)
    assert resp.value == 9999994000
    resp = await test_http_client_async.get_balance(async_stubbed_receiver_prefetched_blockhash)
    assert_valid_response(resp)
    assert resp.value == 10000001000


@pytest.mark.integration
async def test_send_raw_transaction_and_get_balance(
    async_stubbed_sender, async_stubbed_receiver, test_http_client_async
):
    """Test sending a raw transaction to localnet."""
    # Get a recent blockhash
    resp = await test_http_client_async.get_latest_blockhash(Finalized)
    assert_valid_response(resp)
    recent_blockhash = resp.value.blockhash
    assert recent_blockhash is not None
    # Create transfer tx transfer lamports from stubbed sender to async_stubbed_receiver
    blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    ixs = [
        sp.transfer(
            sp.TransferParams(
                from_pubkey=async_stubbed_sender.pubkey(), to_pubkey=async_stubbed_receiver, lamports=1000
            )
        )
    ]
    msg = Message.new_with_blockhash(ixs, async_stubbed_sender.pubkey(), blockhash)
    transfer_tx = Transaction([async_stubbed_sender], msg, blockhash)
    # Send raw transaction
    resp = await test_http_client_async.send_raw_transaction(bytes(transfer_tx))
    assert_valid_response(resp)
    # Confirm transaction
    resp = await test_http_client_async.confirm_transaction(resp.value)
    # Check balances
    resp = await test_http_client_async.get_balance(async_stubbed_sender.pubkey())
    assert_valid_response(resp)
    assert resp.value == 9999988000
    resp = await test_http_client_async.get_balance(async_stubbed_receiver)
    assert_valid_response(resp)
    assert resp.value == 10000002000


@pytest.mark.integration
async def test_send_raw_transaction_and_get_balance_using_latest_blockheight(
    async_stubbed_sender, async_stubbed_receiver, test_http_client_async
):
    """Test sending a raw transaction to localnet using latest blockhash."""
    # Get latest blockhash
    resp = await test_http_client_async.get_latest_blockhash(Finalized)
    assert_valid_response(resp)
    recent_blockhash = resp.value.blockhash
    assert recent_blockhash is not None
    last_valid_block_height = resp.value.last_valid_block_height
    # Create transfer tx transfer lamports from stubbed sender to async_stubbed_receiver
    blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    ixs = [
        sp.transfer(
            sp.TransferParams(
                from_pubkey=async_stubbed_sender.pubkey(), to_pubkey=async_stubbed_receiver, lamports=1000
            )
        )
    ]
    msg = Message.new_with_blockhash(ixs, async_stubbed_sender.pubkey(), blockhash)
    transfer_tx = Transaction([async_stubbed_sender], msg, blockhash)
    # Send raw transaction
    resp = await test_http_client_async.send_raw_transaction(
        bytes(transfer_tx),
        opts=TxOpts(preflight_commitment=Processed, last_valid_block_height=last_valid_block_height),
    )
    assert_valid_response(resp)
    # Confirm transaction
    resp = await test_http_client_async.confirm_transaction(resp.value, last_valid_block_height=last_valid_block_height)
    # Check balances
    resp = await test_http_client_async.get_balance(async_stubbed_sender.pubkey())
    assert_valid_response(resp)
    assert resp.value == 9999982000
    resp = await test_http_client_async.get_balance(async_stubbed_receiver)
    assert_valid_response(resp)
    assert resp.value == 10000003000


@pytest.mark.integration
async def test_confirm_expired_transaction(stubbed_sender, stubbed_receiver, test_http_client_async):
    """Test that RPCException is raised when trying to confirm a transaction that exceeded last valid block height."""
    # Get a recent blockhash
    resp = await test_http_client_async.get_latest_blockhash()
    recent_blockhash = resp.value.blockhash
    assert recent_blockhash is not None
    last_valid_block_height = resp.value.last_valid_block_height - 330
    # Create transfer tx transfer lamports from stubbed sender to stubbed_receiver
    blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    ixs = [
        sp.transfer(sp.TransferParams(from_pubkey=stubbed_sender.pubkey(), to_pubkey=stubbed_receiver, lamports=1000))
    ]
    msg = Message.new_with_blockhash(ixs, stubbed_sender.pubkey(), blockhash)
    transfer_tx = Transaction([stubbed_sender], msg, blockhash)
    # Send raw transaction
    resp = await test_http_client_async.send_raw_transaction(
        bytes(transfer_tx), opts=TxOpts(skip_confirmation=True, skip_preflight=True)
    )
    assert_valid_response(resp)
    # Confirm transaction
    with pytest.raises(TransactionExpiredBlockheightExceededError) as exc_info:
        await test_http_client_async.confirm_transaction(
            resp.value, Finalized, last_valid_block_height=last_valid_block_height
        )
    err_object = exc_info.value.args[0]
    assert "block height exceeded" in err_object


@pytest.mark.integration
async def test_get_fee_for_transaction_message(stubbed_sender, stubbed_receiver, test_http_client_async: AsyncClient):
    """Test that gets a fee for a transaction using get fee for message."""
    # Get latest blockhash
    resp = await test_http_client_async.get_latest_blockhash()
    recent_blockhash = resp.value.blockhash
    assert recent_blockhash is not None
    # Create transfer tx transfer lamports from stubbed sender to stubbed_receiver
    ixs = [
        sp.transfer(sp.TransferParams(from_pubkey=stubbed_sender.pubkey(), to_pubkey=stubbed_receiver, lamports=1000))
    ]
    msg = Message.new_with_blockhash(ixs, stubbed_sender.pubkey(), recent_blockhash)
    # Get fee for transaction message
    fee_resp = await test_http_client_async.get_fee_for_message(msg)
    assert_valid_response(fee_resp)
    assert fee_resp.value is not None


@pytest.mark.integration
async def test_get_fee_for_versioned_message(
    stubbed_sender: Keypair, stubbed_receiver: Pubkey, test_http_client_async: AsyncClient
):
    """Test that gets a fee for a transaction using get_fee_for_message."""
    # Get a recent blockhash
    resp = await test_http_client_async.get_latest_blockhash()
    recent_blockhash = resp.value.blockhash
    assert recent_blockhash is not None
    msg = MessageV0.try_compile(
        payer=stubbed_sender.pubkey(),
        instructions=[
            sp.transfer(
                sp.TransferParams(from_pubkey=stubbed_sender.pubkey(), to_pubkey=stubbed_receiver, lamports=1000)
            )
        ],
        address_lookup_table_accounts=[],
        recent_blockhash=recent_blockhash,
    )
    # get fee for transaction
    fee_resp = await test_http_client_async.get_fee_for_message(msg)
    assert_valid_response(fee_resp)
    assert fee_resp.value is not None


@pytest.mark.integration
async def test_get_block_commitment(test_http_client_async):
    """Test get block commitment."""
    resp = await test_http_client_async.get_block_commitment(5)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_block_time(test_http_client_async):
    """Test get block time."""
    resp = await test_http_client_async.get_block_time(5)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_cluster_nodes(test_http_client_async):
    """Test get cluster nodes."""
    resp = await test_http_client_async.get_cluster_nodes()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_block(test_http_client_async):
    """Test get confirmed block."""
    resp = await test_http_client_async.get_block(2)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_block_height(test_http_client_async):
    """Test get height."""
    resp = await test_http_client_async.get_block_height()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_blocks(test_http_client_async):
    """Test get blocks."""
    resp = await test_http_client_async.get_blocks(5, 10)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_signatures_for_address(test_http_client_async: AsyncClient):
    """Test get signatures for addresses."""
    resp = await test_http_client_async.get_signatures_for_address(VOTE_PROGRAM_ID, limit=1, commitment=Confirmed)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_epoch_info(test_http_client_async):
    """Test get epoch info."""
    resp = await test_http_client_async.get_epoch_info()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_epoch_schedule(test_http_client_async):
    """Test get epoch schedule."""
    resp = await test_http_client_async.get_epoch_schedule()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_latest_blockhash(test_http_client_async):
    """Test get latest blockhash."""
    resp = await test_http_client_async.get_latest_blockhash(Finalized)
    assert_valid_response(resp)
    assert resp.value.blockhash is not None
    assert resp.value.last_valid_block_height is not None


@pytest.mark.integration
async def test_get_slot(test_http_client_async):
    """Test get slot."""
    resp = await test_http_client_async.get_slot()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_first_available_block(test_http_client_async):
    """Test get first available block."""
    resp = await test_http_client_async.get_first_available_block()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_genesis_hash(test_http_client_async):
    """Test get genesis hash."""
    resp = await test_http_client_async.get_genesis_hash()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_identity(test_http_client_async):
    """Test get identity."""
    resp = await test_http_client_async.get_genesis_hash()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_inflation_governor(test_http_client_async):
    """Test get inflation governor."""
    resp = await test_http_client_async.get_inflation_governor()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_inflation_rate(test_http_client_async):
    """Test get inflation rate."""
    resp = await test_http_client_async.get_inflation_rate()
    assert_valid_response(resp)


# XXX: Block not available for slot on local cluster
@pytest.mark.skip
@pytest.mark.integration
async def test_get_inflation_reward(stubbed_sender, test_http_client_async):
    """Test get inflation reward."""
    resp = await test_http_client_async.get_inflation_reward([stubbed_sender.pubkey()], commitment=Confirmed)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_largest_accounts(test_http_client_async):
    """Test get largest accounts."""
    resp = await test_http_client_async.get_largest_accounts()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_leader_schedule(test_http_client_async):
    """Test get leader schedule."""
    resp = await test_http_client_async.get_leader_schedule()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_minimum_balance_for_rent_exemption(test_http_client_async):
    """Test get minimum balance for rent exemption."""
    resp = await test_http_client_async.get_minimum_balance_for_rent_exemption(50)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_slot_leader(test_http_client_async):
    """Test get slot leader."""
    resp = await test_http_client_async.get_slot_leader()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_supply(test_http_client_async):
    """Test get slot leader."""
    resp = await test_http_client_async.get_supply()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_token_largest_accounts(test_http_client_async):
    """Test get token largest accounts."""
    resp = await test_http_client_async.get_token_largest_accounts(WRAPPED_SOL_MINT)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_token_supply(test_http_client_async):
    """Test get token supply."""
    resp = await test_http_client_async.get_token_supply(WRAPPED_SOL_MINT)
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_transaction_count(test_http_client_async):
    """Test get transactinon count."""
    resp = await test_http_client_async.get_transaction_count()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_version(test_http_client_async):
    """Test get version."""
    resp = await test_http_client_async.get_version()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_account_info(async_stubbed_sender, test_http_client_async):
    """Test get_account_info."""
    resp = await test_http_client_async.get_account_info(async_stubbed_sender.pubkey())
    assert_valid_response(resp)
    resp = await test_http_client_async.get_account_info(async_stubbed_sender.pubkey(), encoding="jsonParsed")
    assert_valid_response(resp)
    resp = await test_http_client_async.get_account_info(async_stubbed_sender.pubkey(), data_slice=DataSliceOpts(1, 1))
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_multiple_accounts(async_stubbed_sender, test_http_client_async):
    """Test get_multiple_accounts."""
    pubkeys = [async_stubbed_sender.pubkey()] * 2
    resp = await test_http_client_async.get_multiple_accounts(pubkeys)
    assert_valid_response(resp)
    resp = await test_http_client_async.get_multiple_accounts(pubkeys, encoding="jsonParsed")
    assert_valid_response(resp)
    resp = await test_http_client_async.get_multiple_accounts(pubkeys, data_slice=DataSliceOpts(1, 1))
    assert_valid_response(resp)


@pytest.mark.integration
async def test_get_vote_accounts(test_http_client_async):
    """Test get vote accounts."""
    resp = await test_http_client_async.get_vote_accounts()
    assert_valid_response(resp)


@pytest.mark.integration
async def test_batch_request(test_http_client_async: AsyncClient):
    """Test get vote accounts."""
    reqs = (GetBlockHeight(), GetFirstAvailableBlock())
    parsers = (GetBlockHeightResp, GetFirstAvailableBlockResp)
    resp: Tuple[
        Resp[GetBlockHeightResp], Resp[GetFirstAvailableBlockResp]
    ] = await test_http_client_async._provider.make_batch_request(  # pylint: disable=protected-access
        reqs, parsers
    )
    assert_valid_response(resp[0])
    assert_valid_response(resp[1])
