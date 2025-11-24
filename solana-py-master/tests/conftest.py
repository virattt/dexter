"""Fixtures for pytest."""

import asyncio
import time
from typing import NamedTuple

import pytest
from solders.hash import Hash as Blockhash
from solders.keypair import Keypair
from solders.pubkey import Pubkey

from solana.rpc.api import Client
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Processed
from tests.utils import AIRDROP_AMOUNT, assert_valid_response


class Clients(NamedTuple):
    """Container for http clients."""

    sync: Client
    async_: AsyncClient
    loop: asyncio.AbstractEventLoop


@pytest.fixture(scope="module")
def event_loop():
    """Event loop for pytest-asyncio."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def stubbed_blockhash() -> Blockhash:
    """Arbitrary block hash."""
    return Blockhash.from_string("EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k")


@pytest.fixture(scope="session")
def stubbed_receiver() -> Pubkey:
    """Arbitrary known public key to be used as receiver."""
    return Pubkey.from_string("J3dxNj7nDRRqRRXuEMynDG57DkZK4jYRuv3Garmb1i99")


@pytest.fixture(scope="session")
def stubbed_receiver_prefetched_blockhash() -> Pubkey:
    """Arbitrary known public key to be used as receiver."""
    return Pubkey.from_string("J3dxNj7nDRRqRRXuEMynDG57DkZK4jYRuv3Garmb1i97")


@pytest.fixture(scope="session")
def async_stubbed_receiver() -> Pubkey:
    """Arbitrary known public key to be used as receiver."""
    return Pubkey.from_string("J3dxNj7nDRRqRRXuEMynDG57DkZK4jYRuv3Garmb1i98")


@pytest.fixture(scope="session")
def async_stubbed_receiver_prefetched_blockhash() -> Pubkey:
    """Arbitrary known public key to be used as receiver."""
    return Pubkey.from_string("J3dxNj7nDRRqRRXuEMynDG57DkZK4jYRuv3Garmb1i96")


@pytest.fixture(scope="session")
def stubbed_sender() -> Keypair:
    """Arbitrary known account to be used as sender."""
    return Keypair.from_seed(bytes([8] * Pubkey.LENGTH))


@pytest.fixture(scope="session")
def stubbed_sender_prefetched_blockhash() -> Keypair:
    """Arbitrary known account to be used as sender."""
    return Keypair.from_seed(bytes([9] * Pubkey.LENGTH))


@pytest.fixture(scope="session")
def stubbed_sender_for_token() -> Keypair:
    """Arbitrary known account to be used as sender."""
    return Keypair.from_seed(bytes([2] * Pubkey.LENGTH))


@pytest.fixture(scope="session")
def async_stubbed_sender() -> Keypair:
    """Another arbitrary known account to be used as sender."""
    return Keypair.from_seed(bytes([7] * Pubkey.LENGTH))


@pytest.fixture(scope="session")
def async_stubbed_sender_prefetched_blockhash() -> Keypair:
    """Another arbitrary known account to be used as sender."""
    return Keypair.from_seed(bytes([5] * Pubkey.LENGTH))


@pytest.fixture(scope="session")
def freeze_authority() -> Keypair:
    """Arbitrary known account to be used as freeze authority."""
    return Keypair.from_seed(bytes([6] * Pubkey.LENGTH))


@pytest.fixture(scope="session")
def unit_test_http_client() -> Client:
    """Client to be used in unit tests."""
    client = Client(commitment=Processed)
    return client


@pytest.fixture(scope="session")
def unit_test_http_client_async() -> AsyncClient:
    """Async client to be used in unit tests."""
    client = AsyncClient(commitment=Processed)
    return client


@pytest.fixture(scope="module")
def _sleep_for_first_blocks() -> None:
    """Blocks 0 and 1 are unavailable so we sleep until they're done."""
    time.sleep(10)


@pytest.mark.integration
@pytest.fixture(scope="module")
def test_http_client(docker_ip, docker_services, _sleep_for_first_blocks) -> Client:  # pylint: disable=redefined-outer-name
    """Test http_client.is_connected."""
    port = docker_services.port_for("localnet", 8899)
    http_client = Client(endpoint=f"http://{docker_ip}:{port}", commitment=Processed)
    docker_services.wait_until_responsive(timeout=15, pause=1, check=http_client.is_connected)
    return http_client


@pytest.mark.integration
@pytest.fixture(scope="module")
def test_http_client_async(
    docker_ip,
    docker_services,
    event_loop,
    _sleep_for_first_blocks,  # pylint: disable=redefined-outer-name
) -> AsyncClient:
    """Test http_client.is_connected."""
    port = docker_services.port_for("localnet", 8899)
    http_client = AsyncClient(endpoint=f"http://{docker_ip}:{port}", commitment=Processed)

    def check() -> bool:
        return event_loop.run_until_complete(http_client.is_connected())

    docker_services.wait_until_responsive(timeout=15, pause=1, check=check)
    yield http_client
    event_loop.run_until_complete(http_client.close())


@pytest.mark.integration
@pytest.fixture(scope="function")
def random_funded_keypair(test_http_client: Client) -> Keypair:
    """A new keypair with some lamports."""
    kp = Keypair()
    resp = test_http_client.request_airdrop(kp.pubkey(), AIRDROP_AMOUNT)
    assert_valid_response(resp)
    test_http_client.confirm_transaction(resp.value)
    balance = test_http_client.get_balance(kp.pubkey())
    assert balance.value == AIRDROP_AMOUNT
    return kp
