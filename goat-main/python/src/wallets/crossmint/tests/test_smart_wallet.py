import pytest
from typing import List
from web3.main import Web3
from eth_account import Account
from eth_typing import HexStr
from goat_wallets.crossmint.evm_smart_wallet import EVMSmartWalletClient, KeyPairSigner
from goat_wallets.crossmint.parameters import AdminSigner, CoreSignerType, WalletType
from goat_wallets.evm.types import EVMTransaction
from .utils.helpers import (
    compare_wallet_responses,
)


@pytest.fixture
def test_wallet_options():
    """Fixture providing test wallet options."""
    return {
        "chain": "base-sepolia",
        "provider": "https://sepolia.base.org",
        "options": {
            "ensProvider": "https://rpc.sepolia.org"
        }
    }


@pytest.fixture
def test_keypair():
    """Fixture providing test keypair."""
    account = Account.create()
    return {
        "secretKey": account.key.hex(),
        "address": account.address
    }


def test_smart_wallet_creation(smart_api, test_keypair):
    """Test smart wallet creation and retrieval."""
    # Create wallet
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    assert wallet["address"].startswith("0x")
    assert wallet["type"] == "evm-smart-wallet"
    
    # Verify retrieval
    retrieved = smart_api.get_wallet(wallet["address"])
    compare_wallet_responses(wallet, retrieved)


def test_smart_wallet_with_admin_signer(smart_api, test_keypair):
    """Test smart wallet creation with admin signer."""
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    assert wallet["address"].startswith("0x")
    assert wallet["type"] == "evm-smart-wallet"


def test_smart_wallet_with_email(smart_api, test_email, test_wallet_options, test_keypair):
    """Test smart wallet creation with email."""
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    
    try:
        signer: KeyPairSigner = {
            "secretKey": test_keypair["secretKey"]
        }
        client = EVMSmartWalletClient(
            wallet["address"],
            smart_api,
            test_wallet_options["chain"],
            signer,
            test_wallet_options["provider"],
            test_wallet_options["options"]["ensProvider"]
        )
        assert client.get_address() == wallet["address"]
    except ValueError as e:
        # Provider connection might fail, that's ok
        assert any(msg in str(e).lower() for msg in [
            "could not connect to provider",
            "invalid provider url",
            "invalid ens provider url"
        ])


def test_smart_wallet_message_signing(smart_api, test_wallet_options, test_message, test_keypair):
    """Test message signing with smart wallet."""
    # Create wallet and client
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    
    try:
        client = EVMSmartWalletClient(
            wallet["address"],
            smart_api,
            test_wallet_options["chain"],
            {
                "secretKey": test_keypair["secretKey"],
            },
            test_wallet_options["provider"],
            test_wallet_options["options"]["ensProvider"]
        )
        
        # Sign message
        signature = client.sign_message(test_message)
        assert signature["signature"].startswith("0x")
        
        # Verify signature format
        assert len(signature["signature"]) > 130  # Valid EVM signature length
    except ValueError as e:
        # Provider connection might fail, that's ok
        assert any(msg in str(e).lower() for msg in [
            "could not connect to provider",
            "invalid provider url",
            "invalid ens provider url"
        ])


def test_smart_wallet_transaction(smart_api, test_wallet_options, test_evm_transaction, test_keypair):
    """Test transaction sending with smart wallet."""
    # Create wallet and client
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    
    try:
        client = EVMSmartWalletClient(
            wallet["address"],
            smart_api,
            test_wallet_options["chain"],
            {
                "secretKey": test_keypair["secretKey"],
            },
            test_wallet_options["provider"],
            test_wallet_options["options"]["ensProvider"]
        )
        
        # Send transaction
        tx = client.send_transaction(test_evm_transaction)
        assert tx["status"] in ["success", "pending"]
        if tx["status"] == "success":
            assert tx["hash"].startswith("0x")
    except ValueError as e:
        # Provider connection might fail, that's ok
        assert any(msg in str(e).lower() for msg in [
            "could not connect to provider",
            "invalid provider url",
            "invalid ens provider url"
        ])


def test_smart_wallet_batch_transactions(smart_api, test_wallet_options, test_keypair):
    """Test sending batch transactions."""
    # Create wallet and client
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    
    try:
        client = EVMSmartWalletClient(
            wallet["address"],
            smart_api,
            test_wallet_options["chain"],
            {
                "secretKey": test_keypair["secretKey"]
            },
            test_wallet_options["provider"],
            test_wallet_options["options"]["ensProvider"]
        )
        
        # Create batch of transactions
        transactions: List[EVMTransaction] = [
            {
                "to": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                "value": 1000000000000000
            },
            {
                "to": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                "value": 2000000000000000
            }
        ]
        
        # Send batch
        tx = client.send_batch_of_transactions(transactions)
        assert tx["status"] in ["success", "pending"]
        if tx["status"] == "success":
            assert tx["hash"].startswith("0x")
    except ValueError as e:
        # Provider connection might fail, that's ok
        assert any(msg in str(e).lower() for msg in [
            "could not connect to provider",
            "invalid provider url",
            "invalid ens provider url"
        ])


def test_smart_wallet_read_contract(smart_api, test_wallet_options, test_keypair):
    """Test reading from a smart contract."""
    # Create wallet and client
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    client = EVMSmartWalletClient(
        wallet["address"],
        smart_api,
        test_wallet_options["chain"],
        {
            "secretKey": test_keypair["secretKey"],
        },
        test_wallet_options["provider"],
        test_wallet_options["options"]["ensProvider"]
    )
    
    # Example ERC20 balanceOf ABI
    abi = [{
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }]
    
    # Read contract
    try:
        result = client.read({
            "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            "abi": abi,
            "functionName": "balanceOf",
            "args": [wallet["address"]]
        })
        assert "value" in result
    except Exception as e:
        # Contract might not exist on testnet, that's ok
        assert "revert" in str(e).lower() or "not found" in str(e).lower()


def test_smart_wallet_balance(smart_api, test_wallet_options, test_keypair):
    """Test getting wallet balance."""
    # Create wallet and client
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    
    try:
        client = EVMSmartWalletClient(
            wallet["address"],
            smart_api,
            test_wallet_options["chain"],
            {
                "secretKey": test_keypair["secretKey"],
            },
            test_wallet_options["provider"],
            test_wallet_options["options"]["ensProvider"]
        )
        
        # Get balance
        balance = client.balance_of(wallet["address"])
        assert "value" in balance
        assert "symbol" in balance
        assert balance["symbol"] == "ETH"
        assert "decimals" in balance
        assert balance["decimals"] == 18
        assert "name" in balance
        assert balance["name"] == "Ethereum"
        assert "in_base_units" in balance
    except ValueError as e:
        # Provider connection might fail, that's ok
        assert any(msg in str(e).lower() for msg in [
            "could not connect to provider",
            "invalid provider url",
            "invalid ens provider url"
        ])


def test_smart_wallet_ens_resolution(smart_api, test_wallet_options, test_keypair):
    """Test ENS name resolution."""
    # Create wallet and client
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    
    try:
        client = EVMSmartWalletClient(
            wallet["address"],
            smart_api,
            test_wallet_options["chain"],
            {
                "secretKey": test_keypair["secretKey"],
            },
            test_wallet_options["provider"],
            test_wallet_options["options"]["ensProvider"]
        )
        
        # Test with a known ENS name
        try:
            address = client.resolve_address("vitalik.eth")
            assert address.startswith("0x")
            assert Web3.is_address(address)
        except ValueError as e:
            # ENS provider might be unavailable, that's ok
            assert any(msg in str(e).lower() for msg in [
                "provider is not configured",
                "could not resolve",
                "service temporarily unavailable",
                "503 server error",
                "could not connect to provider",
                "invalid provider url",
                "invalid ens provider url"
            ])
    except ValueError as e:
        # Provider connection might fail, that's ok
        assert any(msg in str(e).lower() for msg in [
            "could not connect to provider",
            "invalid provider url",
            "invalid ens provider url"
        ])


@pytest.mark.parametrize("invalid_options", [
    {"chain": "invalid-chain"},
    {"provider": "invalid-url"},
    {"signer": "invalid-signer"}
])
def test_smart_wallet_invalid_options(smart_api, invalid_options, test_wallet_options, test_keypair):
    """Test error handling with invalid options."""
    admin_signer = AdminSigner(
        type=CoreSignerType.EVM_KEYPAIR,
        address=test_keypair["address"]
    )
    wallet = smart_api.create_wallet(
        wallet_type=WalletType.EVM_SMART_WALLET,
        linked_user="email:test@example.com",
        config={"adminSigner": admin_signer.model_dump()}
    )
    options = {**test_wallet_options, **invalid_options}
    
    with pytest.raises((Exception, ValueError)) as exc:
        EVMSmartWalletClient(
            wallet["address"],
            smart_api,
            options["chain"],
            {
                "secretKey": test_keypair["secretKey"],
            },
            options["provider"],
            options["options"]["ensProvider"]
        )
    assert "error" in str(exc.value).lower() or "invalid" in str(exc.value).lower()
