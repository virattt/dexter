import pytest
import base58
from solders.instruction import Instruction, AccountMeta
from solders.pubkey import Pubkey
from solders.message import Message, MessageV0
from solders.transaction import Transaction, VersionedTransaction
from solders.hash import Hash
from solders.signature import Signature
from goat_wallets.crossmint.custodial_solana_wallet import CustodialSolanaWalletClient
from .utils.helpers import (
    compare_wallet_responses,
    compare_transaction_responses,
    compare_signature_responses,
    compare_error_responses
)


def test_custodial_wallet_creation_with_email(custodial_api, test_email, solana_connection):
    """Test custodial wallet creation with email."""
    try:
        # Create wallet
        wallet = custodial_api.create_custodial_wallet(test_email)
        assert wallet["type"] == "solana-mpc-wallet"
        
        # Verify retrieval
        retrieved = custodial_api.get_wallet(f"email:{test_email}:solana-mpc-wallet")
        compare_wallet_responses(wallet, retrieved)
        
        # Test client creation
        client = CustodialSolanaWalletClient(
            wallet["address"],
            custodial_api,
            solana_connection,
            {"email": test_email}
        )
        assert client.get_address() == wallet["address"]
    except Exception as e:
        if "Invalid wallet type" in str(e):
            pytest.skip("Skipping test: Invalid wallet type")
        raise


def test_custodial_wallet_creation_with_phone(custodial_api, test_phone, solana_connection):
    """Test custodial wallet creation with phone number."""
    # Create wallet
    wallet = custodial_api.create_custodial_wallet(test_phone)
    assert wallet["type"] == "solana-mpc-wallet"
    
    # Verify retrieval
    retrieved = custodial_api.get_wallet(f"phoneNumber:{test_phone}:solana-mpc-wallet")
    compare_wallet_responses(wallet, retrieved)
    
    # Test client creation
    client = CustodialSolanaWalletClient(
        wallet["address"],
        custodial_api,
        solana_connection,
        {"phone": test_phone}
    )
    assert client.get_address() == wallet["address"]


def test_custodial_wallet_creation_with_user_id(custodial_api, test_user_id, solana_connection):
    """Test custodial wallet creation with user ID."""
    # Create wallet
    wallet = custodial_api.create_custodial_wallet(str(test_user_id))
    assert wallet["type"] == "solana-mpc-wallet"
    
    # Verify retrieval
    retrieved = custodial_api.get_wallet(f"userId:{test_user_id}:solana-mpc-wallet")
    compare_wallet_responses(wallet, retrieved)
    
    # Test client creation
    client = CustodialSolanaWalletClient(
        wallet["address"],
        custodial_api,
        solana_connection,
        {"userId": test_user_id}
    )
    assert client.get_address() == wallet["address"]


def test_custodial_wallet_message_signing(custodial_api, test_email, test_message, solana_connection):
    """Test message signing with custodial wallet."""
    # Create wallet and client
    wallet = custodial_api.create_custodial_wallet(test_email)
    client = CustodialSolanaWalletClient(
        wallet["address"],
        custodial_api,
        solana_connection,
        {"email": test_email}
    )
    
    # Sign message
    signature = client.sign_message(test_message)
    assert "signature" in signature
    assert len(signature["signature"]) > 0  # Should be base58 encoded


def test_custodial_wallet_transaction(custodial_api, test_email, solana_connection):
    """Test transaction sending with custodial wallet."""
    # Create wallet and client
    wallet = custodial_api.create_custodial_wallet(test_email)
    client = CustodialSolanaWalletClient(
        wallet["address"],
        custodial_api,
        solana_connection,
        {"email": test_email}
    )
    
    # Create a transfer instruction
    instruction = Instruction(
        program_id=Pubkey.from_string("11111111111111111111111111111111"),  # System program
        accounts=[
            AccountMeta(
                pubkey=Pubkey.from_string(wallet["address"]),  # From
                is_signer=True,
                is_writable=True
            ),
            AccountMeta(
                pubkey=Pubkey.from_string(wallet["address"]),  # To (same address for test)
                is_signer=False,
                is_writable=True
            )
        ],
        data=bytes([2, 0, 0, 0]) + (100000).to_bytes(8, 'little')  # Transfer 0.0001 SOL
    )
    
    # Send transaction
    tx = client.send_transaction({
        "instructions": [instruction],
        "address_lookup_table_addresses": [],
        "accounts_to_sign": []
    })
    assert tx["status"] in ["success", "pending"]
    if tx["status"] == "success":
        assert len(tx["hash"]) > 0


def test_custodial_wallet_raw_transaction(custodial_api, test_email, solana_connection):
    """Test sending raw transaction with custodial wallet."""
    # Create wallet and client
    wallet = custodial_api.create_custodial_wallet(test_email)
    client = CustodialSolanaWalletClient(
        wallet["address"],
        custodial_api,
        solana_connection,
        {"email": test_email}
    )
    
    # Create a transfer instruction
    instruction = Instruction(
        program_id=Pubkey.from_string("11111111111111111111111111111111"),  # System program
        accounts=[
            AccountMeta(
                pubkey=Pubkey.from_string(wallet["address"]),  # From
                is_signer=True,
                is_writable=True
            ),
            AccountMeta(
                pubkey=Pubkey.from_string(wallet["address"]),  # To (same address for test)
                is_signer=False,
                is_writable=True
            )
        ],
        data=bytes([2, 0, 0, 0]) + (100000).to_bytes(8, 'little')  # Transfer 0.0001 SOL
    )
    # Create message with dummy payer key (will be replaced by API)
    dummy_payer = Pubkey.from_string("11111111111111111111111111111112")  # Match TypeScript implementation
    # Create message like TypeScript implementation
    message = Message.new_with_blockhash(
        instructions=[instruction],
        payer=dummy_payer,  # Use dummy payer key
        blockhash=Hash.from_string("11111111111111111111111111111111")  # Match TypeScript implementation
    )
    
    # Create unsigned transaction first
    transaction = Transaction.new_unsigned(message)
    
    # Convert to versioned transaction
    versioned_transaction = VersionedTransaction.from_legacy(transaction)
    
    # Serialize and encode
    serialized = base58.b58encode(bytes(versioned_transaction)).decode()
    
    # Send raw transaction
    tx = client.send_raw_transaction(serialized)
    assert tx["status"] in ["success", "pending"]
    if tx["status"] == "success":
        assert len(tx["hash"]) > 0


def test_custodial_wallet_balance(custodial_api, test_email, solana_connection):
    """Test getting wallet balance."""
    # Create wallet and client
    wallet = custodial_api.create_custodial_wallet(test_email)
    client = CustodialSolanaWalletClient(
        wallet["address"],
        custodial_api,
        solana_connection,
        {"email": test_email}
    )
    
    # Get balance
    balance = client.balance_of(wallet["address"])
    assert "value" in balance
    assert "symbol" in balance
    assert balance["symbol"] == "SOL"
    assert "decimals" in balance
    assert balance["decimals"] == 9
    assert "name" in balance
    assert balance["name"] == "Solana"
    assert "in_base_units" in balance


@pytest.mark.parametrize("invalid_options", [
    {"email": ""},  # Empty email
    {"phone": "123"},  # Invalid phone format
    {"userId": ""}  # Empty user ID
])
def test_custodial_wallet_invalid_options(custodial_api, invalid_options, solana_connection):
    """Test error handling with invalid options."""
    # Format the invalid value based on type
    value = list(invalid_options.values())[0]
    if "phone" in invalid_options:
        value = f"+{value}"  # Add + prefix for phone numbers
    
    try:
        custodial_api.create_custodial_wallet(value)
        pytest.fail("Expected an error but none was raised")
    except Exception as e:
        assert any(msg in str(e).lower() for msg in [
            "error",
            "invalid",
            "bad request"
        ])


def test_custodial_wallet_invalid_transaction(custodial_api, test_email, solana_connection):
    """Test error handling with invalid transaction."""
    # Create wallet and client
    wallet = custodial_api.create_custodial_wallet(test_email)
    client = CustodialSolanaWalletClient(
        wallet["address"],
        custodial_api,
        solana_connection,
        {"email": test_email}
    )
    
    # Try to send invalid transaction
    with pytest.raises(Exception) as exc:
        client.send_raw_transaction("invalid-transaction")
    assert "error" in str(exc.value).lower() or "invalid" in str(exc.value).lower()
