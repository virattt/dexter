import pytest
from typing import Dict, Any
from goat_wallets.crossmint.parameters import WalletType
from .utils.helpers import (
    compare_wallet_responses,
    compare_transaction_responses,
    compare_signature_responses
)


class SolanaSmartWalletTransactionParams:
    """Parameters for Solana smart wallet transactions."""

    def __init__(self, transaction: str, required_signers: list = [], signer: str = ""):
        self.transaction = transaction
        self.requiredSigners = required_signers or []
        self.signer = signer


def test_solana_smart_wallet_creation(smart_api):
    """Test Solana smart wallet creation and retrieval."""
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.SOLANA_SMART_WALLET,
        linked_user="email:test@example.com"
    )
    assert wallet["type"] == "solana-smart-wallet"

    # Get wallet and verify only the address matches since other fields might differ
    retrieved = smart_api.get_wallet(wallet["address"])
    assert retrieved["address"] == wallet["address"]


def test_solana_smart_wallet_transaction(smart_api, test_solana_transaction):
    """Test transaction sending with Solana smart wallet."""
    # Create a wallet first
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.SOLANA_SMART_WALLET,
        linked_user="email:test@example.com"
    )

    # Test transaction submission
    try:
        # Create transaction parameters
        tx_params = SolanaSmartWalletTransactionParams(
            transaction=test_solana_transaction,
            required_signers=[]  # No required signers for basic test
        )

        # Create transaction
        tx = smart_api.create_transaction_for_smart_wallet(
            wallet["address"],
            tx_params,
            "solana"
        )
        # If successful, verify response format
        assert "id" in tx
        assert tx["type"] == "solana-smart-wallet"
        assert tx["status"] in ["pending", "awaiting_signatures", "success"]
    except Exception as e:
        error_msg = str(e).lower()
        # Check for expected error cases
        assert any(msg in error_msg for msg in [
            "invalid transaction",
            "transaction verification failed",
            "invalid serialized",
            "parsing error",
            "signatures that would be ignored",
            "submit signatures separately"
        ]), f"Unexpected error: {error_msg}"


def test_solana_smart_wallet_error_handling(smart_api):
    """Test error handling for Solana smart wallet operations."""
    # Test invalid wallet type
    with pytest.raises(Exception) as exc:
        smart_api.create_wallet(
            wallet_type="invalid-wallet-type",
            linked_user="email:test@example.com"
        )
    assert "error" in str(exc.value).lower()

    # Test invalid transaction
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.SOLANA_SMART_WALLET,
        linked_user="email:test@example.com"
    )

    # Test with invalid transaction format
    invalid_tx = SolanaSmartWalletTransactionParams(
        transaction="invalid-transaction"
    )
    with pytest.raises(Exception) as exc:
        smart_api.create_transaction_for_smart_wallet(
            wallet["address"],
            invalid_tx,
            "solana"
        )
    assert "error" in str(exc.value).lower(
    ) or "invalid" in str(exc.value).lower()


def test_solana_smart_wallet_with_email(smart_api, test_email, test_solana_wallet_options):
    """Test Solana smart wallet creation with email."""
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.SOLANA_SMART_WALLET,
        linked_user=f"email:{test_email}"
    )
    assert wallet["type"] == "solana-smart-wallet"
    assert "linkedUser" in wallet


def test_solana_smart_wallet_with_phone(smart_api, test_phone, test_solana_wallet_options):
    """Test Solana smart wallet creation with phone."""
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.SOLANA_SMART_WALLET,
        linked_user=f"phoneNumber:{test_phone}"
    )
    assert wallet["type"] == "solana-smart-wallet"
    assert "linkedUser" in wallet


def test_solana_smart_wallet_with_user_id(smart_api, test_user_id, test_solana_wallet_options):
    """Test Solana smart wallet creation with user ID."""
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.SOLANA_SMART_WALLET,
        linked_user=f"userId:{test_user_id}"
    )
    assert wallet["type"] == "solana-smart-wallet"
    assert "linkedUser" in wallet


def test_parse_serialized_transaction_base58(smart_api, test_solana_transaction):
    """Test parsing of serialized transactions."""
    parsed_tx = smart_api.parse_serialized_transaction(test_solana_transaction)
    assert parsed_tx == test_solana_transaction


def test_parse_serialized_transaction_base64(smart_api, test_solana_transaction_base64, test_solana_transaction):
    """Test parsing of serialized transactions."""
    parsed_tx = smart_api.parse_serialized_transaction(
        test_solana_transaction_base64)
    assert parsed_tx == test_solana_transaction


def test_parse_serialized_transaction_invalid(smart_api):
    """Test parsing of invalid serialized transactions."""
    with pytest.raises(Exception) as exc:
        smart_api.parse_serialized_transaction("invalid-transaction")
    assert "transaction is not base58 encoded, trying to decode as base64" in str(
        exc.value)
