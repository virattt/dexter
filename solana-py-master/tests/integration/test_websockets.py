# pylint: disable=unused-argument,redefined-outer-name
"""Tests for the Websocket Client."""

from typing import AsyncGenerator, List, Tuple

import asyncstdlib
import pytest
from solders import system_program as sp
from solders.keypair import Keypair
from solders.message import Message
from solders.pubkey import Pubkey
from solders.rpc.config import RpcTransactionLogsFilter, RpcTransactionLogsFilterMentions
from solders.rpc.requests import AccountSubscribe, AccountUnsubscribe, Body, LogsSubscribe, LogsUnsubscribe
from solders.rpc.responses import (
    AccountNotification,
    LogsNotification,
    BlockNotification,
    ProgramNotification,
    RootNotification,
    SignatureNotification,
    SlotNotification,
    SlotUpdateNotification,
    SubscriptionResult,
    VoteNotification,
)
from solders.system_program import ID as SYS_PROGRAM_ID
from websockets.legacy.client import WebSocketClientProtocol

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Finalized
from solana.rpc.websocket_api import SolanaWsClientProtocol, connect
from solders.transaction import Transaction

from ..utils import AIRDROP_AMOUNT


@pytest.fixture
async def websocket(
    test_http_client_async: AsyncClient, docker_ip, docker_services
) -> AsyncGenerator[WebSocketClientProtocol, None]:
    """Websocket connection."""
    port = docker_services.port_for("localnet", 8900)
    async with connect(uri=f"ws://{docker_ip}:{port}") as client:
        yield client


@pytest.fixture
async def multiple_subscriptions(
    stubbed_sender: Keypair, websocket: SolanaWsClientProtocol
) -> AsyncGenerator[List[Body], None]:
    """Setup multiple subscriptions."""
    reqs: List[Body] = [
        LogsSubscribe(filter_=RpcTransactionLogsFilter.All, id=websocket.increment_counter_and_get_id()),
        AccountSubscribe(stubbed_sender.pubkey(), id=websocket.increment_counter_and_get_id()),
    ]
    await websocket.send_data(reqs)  # None
    first_resp = await websocket.recv()
    msg0 = first_resp[0]
    msg1 = first_resp[1]
    assert isinstance(msg0, SubscriptionResult)
    assert isinstance(msg1, SubscriptionResult)
    logs_subscription_id, account_subscription_id = msg0.result, msg1.result
    yield reqs
    unsubscribe_reqs: List[Body] = [
        LogsUnsubscribe(logs_subscription_id, websocket.increment_counter_and_get_id()),
        AccountUnsubscribe(account_subscription_id, websocket.increment_counter_and_get_id()),
    ]
    await websocket.send_data(unsubscribe_reqs)


@pytest.fixture
async def account_subscribed(
    stubbed_sender: Keypair, websocket: SolanaWsClientProtocol
) -> AsyncGenerator[Pubkey, None]:
    """Setup account subscription."""
    recipient = Keypair()
    await websocket.account_subscribe(recipient.pubkey())
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield recipient.pubkey()
    await websocket.account_unsubscribe(subscription_id)


@pytest.fixture
async def logs_subscribed(stubbed_sender: Keypair, websocket: SolanaWsClientProtocol) -> AsyncGenerator[None, None]:
    """Setup logs subscription."""
    await websocket.logs_subscribe()
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.logs_unsubscribe(subscription_id)


@pytest.fixture
async def logs_subscribed_mentions_filter(
    stubbed_sender: Keypair, websocket: SolanaWsClientProtocol
) -> AsyncGenerator[None, None]:
    """Setup logs subscription with a mentions filter."""
    await websocket.logs_subscribe(RpcTransactionLogsFilterMentions(SYS_PROGRAM_ID))
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.logs_unsubscribe(subscription_id)


@pytest.fixture
async def block_subscribed(websocket: SolanaWsClientProtocol) -> AsyncGenerator[None, None]:
    """Setup block subscription."""
    await websocket.block_subscribe()
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.block_unsubscribe(subscription_id)


@pytest.fixture
async def program_subscribed(
    websocket: SolanaWsClientProtocol, test_http_client_async: AsyncClient
) -> AsyncGenerator[Tuple[Keypair, Keypair], None]:
    """Setup program subscription."""
    program = Keypair()
    owned = Keypair()
    airdrop_resp = await test_http_client_async.request_airdrop(owned.pubkey(), AIRDROP_AMOUNT)
    await test_http_client_async.confirm_transaction(airdrop_resp.value)
    await websocket.program_subscribe(program.pubkey())
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield program, owned
    await websocket.program_unsubscribe(subscription_id)


@pytest.fixture
async def signature_subscribed(
    websocket: SolanaWsClientProtocol, test_http_client_async: AsyncClient
) -> AsyncGenerator[None, None]:
    """Setup signature subscription."""
    recipient = Keypair()
    airdrop_resp = await test_http_client_async.request_airdrop(recipient.pubkey(), AIRDROP_AMOUNT)
    await websocket.signature_subscribe(airdrop_resp.value)
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.signature_unsubscribe(subscription_id)


@pytest.fixture
async def slot_subscribed(websocket: SolanaWsClientProtocol) -> AsyncGenerator[None, None]:
    """Setup slot subscription."""
    await websocket.slot_subscribe()
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.slot_unsubscribe(subscription_id)


@pytest.fixture
async def slots_updates_subscribed(websocket: SolanaWsClientProtocol) -> AsyncGenerator[None, None]:
    """Setup slots updates subscription."""
    await websocket.slots_updates_subscribe()
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.slots_updates_unsubscribe(subscription_id)


@pytest.fixture
async def root_subscribed(websocket: SolanaWsClientProtocol) -> AsyncGenerator[None, None]:
    """Setup root subscription."""
    await websocket.root_subscribe()
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.root_unsubscribe(subscription_id)


@pytest.fixture
async def vote_subscribed(websocket: SolanaWsClientProtocol) -> AsyncGenerator[None, None]:
    """Setup vote subscription."""
    await websocket.vote_subscribe()
    first_resp = await websocket.recv()
    msg = first_resp[0]
    assert isinstance(msg, SubscriptionResult)
    subscription_id = msg.result
    yield
    await websocket.vote_unsubscribe(subscription_id)


@pytest.mark.integration
async def test_multiple_subscriptions(
    stubbed_sender: Keypair,
    test_http_client_async: AsyncClient,
    multiple_subscriptions: List[Body],
    websocket: SolanaWsClientProtocol,
):
    """Test subscribing to multiple feeds."""
    await test_http_client_async.request_airdrop(stubbed_sender.pubkey(), AIRDROP_AMOUNT)
    async for idx, message in asyncstdlib.enumerate(websocket):
        for item in message:
            if isinstance(item, (AccountNotification, LogsNotification)):
                assert item.result is not None
            else:
                raise ValueError(f"Unexpected message for this test: {item}")
        if idx == len(multiple_subscriptions) - 1:
            break
    balance = await test_http_client_async.get_balance(stubbed_sender.pubkey(), Finalized)
    assert balance.value == AIRDROP_AMOUNT


@pytest.mark.integration
async def test_account_subscribe(
    test_http_client_async: AsyncClient, websocket: SolanaWsClientProtocol, account_subscribed: Pubkey
):
    """Test account subscription."""
    await test_http_client_async.request_airdrop(account_subscribed, AIRDROP_AMOUNT)
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, AccountNotification)
    assert msg.result.value.lamports == AIRDROP_AMOUNT


@pytest.mark.integration
async def test_logs_subscribe(
    test_http_client_async: AsyncClient,
    websocket: SolanaWsClientProtocol,
    logs_subscribed: None,
):
    """Test logs subscription."""
    recipient = Keypair().pubkey()
    await test_http_client_async.request_airdrop(recipient, AIRDROP_AMOUNT)
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, LogsNotification)
    assert msg.result.value.logs[0] == "Program 11111111111111111111111111111111 invoke [1]"


@pytest.mark.integration
async def test_logs_subscribe_mentions_filter(
    test_http_client_async: AsyncClient,
    websocket: SolanaWsClientProtocol,
    logs_subscribed_mentions_filter: None,
):
    """Test logs subscription with a mentions filter."""
    recipient = Keypair().pubkey()
    await test_http_client_async.request_airdrop(recipient, AIRDROP_AMOUNT)
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, LogsNotification)
    assert msg.result.value.logs[0] == "Program 11111111111111111111111111111111 invoke [1]"


@pytest.mark.integration
async def test_block_subscribe(
    websocket: SolanaWsClientProtocol,
    block_subscribed: None,
):
    """Test block subscription."""
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, BlockNotification)
    assert msg.result.value.slot >= 0


@pytest.mark.integration
async def test_program_subscribe(
    test_http_client_async: AsyncClient,
    websocket: SolanaWsClientProtocol,
    program_subscribed: Tuple[Keypair, Keypair],
):
    """Test program subscription."""
    program, owned = program_subscribed
    ixs = [sp.assign(sp.AssignParams(pubkey=owned.pubkey(), owner=program.pubkey()))]
    blockhash = (await test_http_client_async.get_latest_blockhash()).value.blockhash
    msg = Message.new_with_blockhash(ixs, owned.pubkey(), blockhash)
    transaction = Transaction([owned], msg, blockhash)
    await test_http_client_async.send_transaction(transaction)
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, ProgramNotification)
    assert msg.result.value.pubkey == owned.pubkey()


@pytest.mark.integration
async def test_signature_subscribe(
    websocket: SolanaWsClientProtocol,
    signature_subscribed: None,
):
    """Test signature subscription."""
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, SignatureNotification)
    assert msg.result.value.err is None


@pytest.mark.integration
async def test_slot_subscribe(
    websocket: SolanaWsClientProtocol,
    slot_subscribed: None,
):
    """Test slot subscription."""
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, SlotNotification)
    assert msg.result.root >= 0


@pytest.mark.integration
async def test_slots_updates_subscribe(
    websocket: SolanaWsClientProtocol,
    slots_updates_subscribed: None,
):
    """Test slots updates subscription."""
    async for idx, resp in asyncstdlib.enumerate(websocket):
        msg = resp[0]
        assert isinstance(msg, SlotUpdateNotification)
        assert msg.result.slot > 0
        if idx == 40:
            break


@pytest.mark.integration
async def test_root_subscribe(
    websocket: SolanaWsClientProtocol,
    root_subscribed: None,
):
    """Test root subscription."""
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, RootNotification)
    assert msg.result >= 0


@pytest.mark.integration
async def test_vote_subscribe(
    websocket: SolanaWsClientProtocol,
    vote_subscribed: None,
):
    """Test vote subscription."""
    main_resp = await websocket.recv()
    msg = main_resp[0]
    assert isinstance(msg, VoteNotification)
    assert msg.result.slots
