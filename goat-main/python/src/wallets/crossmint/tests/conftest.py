import pytest
import os
from goat_wallets.crossmint import CrossmintWalletsAPI
from solana.rpc.api import Client as SolanaClient


@pytest.fixture
def custodial_api():
    """Fixture providing CrossmintWalletsAPI instance with custodial wallet API key."""
    return CrossmintWalletsAPI(
        api_key=os.environ["CROSSMINT_STAGING_API_KEY_CUSTODIAL"],
        base_url="https://staging.crossmint.com"
    )


@pytest.fixture
def smart_api():
    """Fixture providing CrossmintWalletsAPI instance with smart wallet API key."""
    return CrossmintWalletsAPI(
        api_key=os.environ["CROSSMINT_STAGING_API_KEY_SMART"],
        base_url="https://staging.crossmint.com"
    )


@pytest.fixture
def test_message():
    """Fixture providing a test message for signing."""
    return "Test message to sign"


@pytest.fixture
def test_evm_transaction():
    """Fixture providing a test EVM transaction."""
    return {
        "to": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "value": 1000000000000000
    }


@pytest.fixture
def test_solana_wallet_options():
    """Fixture providing test Solana wallet options."""
    return {
        "chain": "solana",
        "provider": "https://api.devnet.solana.com"
    }


@pytest.fixture
def test_solana_message():
    """Fixture providing test Solana message."""
    return "Hello Solana"


@pytest.fixture
def test_solana_transaction():
    """Fixture providing test Solana transaction."""
    # Example of a valid base58-encoded Solana transaction
    # This is a minimal transfer transaction encoded in base58
    return "4hXTCkRzt9WyecNzV1XPgCDfGAZzQKNxLXgynz5QDuWWPSAZBZSHptvWRL3BjCvzUXRdKvHL2b7yGrRQcWyaqsaBCncVG7BFggS8w9snUts67BSh3EqKpXLUm5UMHfD7ZBe9GhARjbNQMLJ1QD3Spr6oMTBU6EhdB4RD8CP2xUxr2u3d6fos36PD98XS6oX8TQjLpsMwncs5DAMiD4nNnR8NBfyghGCWvCVifVwvA8B8TJxE1aiyiv2L429BCWfyzAme5sZW8rDb14NeCQHhZbtNqfXhcp2tAnaAT"


@pytest.fixture
def test_solana_transaction_base64():
    """Fixture providing test Solana transaction encoded in base64."""
    return "AVXo5X7UNzpuOmYzkZ+fqHDGiRLTSMlWlUCcZKzEV5CIKlrdvZa3/2GrJJfPrXgZqJbYDaGiOnP99tI/sRJfiwwBAAEDRQ/n5E5CLbMbHanUG3+iVvBAWZu0WFM6NoB5xfybQ7kNwwgfIhv6odn2qTUu/gOisDtaeCW1qlwW/gx3ccr/4wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvsInicc+E3IZzLqeA+iM5cn9kSaeFzOuClz1Z2kZQy0BAgIAAQwCAAAAAPIFKgEAAAA="


@pytest.fixture
def solana_connection():
    """Fixture providing Solana RPC client connection."""
    return SolanaClient("https://api.devnet.solana.com")


@pytest.fixture
def test_email():
    """Fixture providing test email for wallet creation."""
    return "test@example.com"


@pytest.fixture
def test_phone():
    """Fixture providing test phone for wallet creation."""
    return "+1234567890"


@pytest.fixture
def test_user_id():
    """Fixture providing test user ID for wallet creation."""
    return 12345
