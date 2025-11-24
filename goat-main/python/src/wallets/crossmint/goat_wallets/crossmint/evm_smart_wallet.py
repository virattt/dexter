import time
from typing import Any, Dict, List, Optional, TypedDict, Union, cast, NewType
from goat.classes.wallet_client_base import Balance, Signature
from goat.types.chain import EvmChain, NativeCurrency
from goat_wallets.evm.types import EVMTypedData
from goat_wallets.crossmint.solana_smart_wallet import LinkedUser
from goat_wallets.evm import EVMWalletClient, EVMTransaction, EVMReadRequest, EVMReadResult
from web3.main import Web3
from web3.providers.rpc import HTTPProvider
from eth_typing import ChecksumAddress
from eth_account.messages import encode_defunct
from eth_account import Account
from ens import ENS

from .api_client import CrossmintWalletsAPI, Call
from .base_wallet import get_locator, BaseWalletClient


def validate_0x_string(value: str) -> str:
    if not value.startswith("0x"):
        raise ValueError("CustodialSigner must start with '0x'")
    return value

String0x = NewType('String0x', str)
String0x.__supertype__ = staticmethod(validate_0x_string)  # type: ignore

CustodialSigner = NewType('CustodialSigner', String0x)

class KeyPairSigner(TypedDict):
    secretKey: String0x

Signer = Union[CustodialSigner, KeyPairSigner]

# Use sync Web3 for encoding and address utilities
w3_sync = Web3()

def build_transaction_data(
    recipient_address: str,
    abi: Optional[List] = None,
    function_name: Optional[str] = None,
    args: Optional[List] = None,
    value: Optional[int] = None
) -> Call:
    if not abi:
        return Call(
            to=recipient_address,
            value=str(value or 0),
            data="0x"
        )
    
    if not function_name:
        raise ValueError("Function name is required when ABI is provided")
    
    contract = w3_sync.eth.contract(
        address=w3_sync.to_checksum_address(recipient_address),
        abi=abi
    )
    data = contract.get_function_by_name(function_name)(*args or []).build_transaction()['data']
    
    return Call(
        to=recipient_address,
        value=str(value or 0),
        data=data.hex()
    )


class EVMSmartWalletClient(EVMWalletClient, BaseWalletClient):
    """EVM Smart Wallet implementation using Crossmint."""
    
    def __init__(
        self,
        address: str,
        api_client: CrossmintWalletsAPI,
        chain: str,
        signer: Signer,
        provider_url: str,
        ens_provider_url: Optional[str] = None,
        tokens = None,
        enable_send = True
    ):
        """Initialize Smart Wallet client.
        
        Args:
            address: Wallet address
            api_client: Crossmint API client
            chain: Chain identifier
            signer: Signer configuration (address string or keypair dict)
            provider_url: RPC provider URL
            ens_provider_url: Optional ENS provider URL
            tokens: List of token configurations
            enable_send: Whether to enable send functionality
        """
        EVMWalletClient.__init__(self, tokens=tokens, enable_send=enable_send)
        BaseWalletClient.__init__(self, address, api_client, chain)
        self._signer = signer
        
        self._w3 = Web3(HTTPProvider(provider_url))
        if ens_provider_url:
            ens_w3 = Web3(HTTPProvider(ens_provider_url))
            self._ens = ENS.from_web3(ens_w3)
        else:
            self._ens = None
        
        self._locator = get_evm_locator(address)
    
    @property
    def has_custodial_signer(self) -> bool:
        """Check if using custodial signer."""
        return isinstance(self._signer, str)
    
    @property
    def secret_key(self) -> Optional[str]:
        """Get secret key if using keypair signer."""
        return cast(KeyPairSigner, self._signer)["secretKey"] if not self.has_custodial_signer else None
        
    @property
    def signerAccount(self) -> Optional[Account]:
        """Get signer account if using keypair signer."""
        if self.has_custodial_signer:
            return None
        return Account.from_key(cast(KeyPairSigner, self._signer)["secretKey"])
    
    def get_address(self) -> str:
        """Get wallet address."""
        return self._address
    
    def get_chain(self) -> EvmChain:
        """Get chain information."""
        return EvmChain(
            type="evm",
            id=self._w3.eth.chain_id,
            nativeCurrency=NativeCurrency(
                name="Ether",
                symbol="ETH",
                decimals=18
            )
        )
    
    def get_chain_id(self) -> int:
        """Get chain ID."""
        return self._w3.eth.chain_id
    
    def get_native_balance(self) -> int:
        """Get native balance of this wallet in base units."""
        balance = self.balance_of(self._address)
        return int(balance["in_base_units"])
    
    def resolve_address(self, address: str) -> ChecksumAddress:
        """Resolve ENS name to address."""
        try:
            return w3_sync.to_checksum_address(address)
        except ValueError:
            if not self._ens:
                raise ValueError("ENS provider is not configured")
            
            try:
                resolved = self._ens.address(address)
                if not resolved:
                    raise ValueError("ENS name could not be resolved")
                return w3_sync.to_checksum_address(resolved)
            except Exception as e:
                raise ValueError(f"Failed to resolve ENS name: {e}")
    
    def sign_message(self, message: str) -> Signature:
        """Sign a message with the wallet's private key.
        
        Args:
            message: Message to sign
            
        Returns:
            Dict containing the signature
            
        Raises:
            ValueError: If signature fails or is undefined
        """
        signer_address = None
        if not self.has_custodial_signer:
            account = self.signerAccount
            if not account:
                raise ValueError("Signer account is not available")
            signer_address = account.address # type: ignore
            
        response = self._client.sign_message_for_smart_wallet(
            self._address,
            message,
            self._chain,
            signer_address
        )
        signature_id = response["id"]
        approvals = response.get("approvals", {})
        
        if not self.has_custodial_signer:
            account = self.signerAccount
            if not account:
                raise ValueError("Signer account is not available")
            
            pending_approvals = approvals.get("pending", [])
            if not pending_approvals:
                raise ValueError("No pending approvals found")
                
            to_sign = pending_approvals[0].get("message")
            if not to_sign:
                raise ValueError("No message to sign in approvals")
            
            signature = account.sign_message(
                encode_defunct(hexstr=to_sign)
            ).signature.hex()
            
            self._client.approve_signature_for_smart_wallet(
                signature_id,
                self._address,
                f"evm-keypair:{account.address}",  # type: ignore
                signature
            )
        
        while True:
            status = self._client.check_signature_status(
                signature_id,
                self._address
            )
            
            if status["status"] == "success":
                if not status.get("outputSignature"):
                    raise ValueError("Signature is undefined")
                return {"signature": status["outputSignature"]}
            
            if status["status"] == "failed":
                raise ValueError("Signature failed")
            
            time.sleep(2)
    
    def sign_typed_data(self, types: Dict[str, Any], primary_type: str, domain: Dict[str, Any], value: Dict[str, Any]) -> Signature:
        """Sign typed data."""
        if not isinstance(self._signer, dict):
            raise ValueError("Keypair signer is required for typed data signing")

        typed_data: EVMTypedData = {
            "types": types,
            "primaryType": primary_type,
            "domain": domain, # type: ignore
            "value": value
        }

        response = self._client.sign_typed_data_for_smart_wallet(
            self._address,
            typed_data,
            self._chain,
            Account.from_key(cast(KeyPairSigner, self._signer)["secretKey"]).address
        )
        
        if not self.has_custodial_signer:
            if not self.secret_key:
                raise ValueError("Signer account is not available")
            
            to_sign = response["approvals"]["pending"][0]["message"]
            account = self._w3.eth.account.from_key(self.secret_key)
            signature = account.sign_message(
                encode_defunct(hexstr=to_sign)
            ).signature.hex()
            
            self._client.approve_signature_for_smart_wallet(
                response["id"],
                self._address,
                f"evm-keypair:{account.address}",
                signature
            )
        
        while True:
            status = self._client.check_signature_status(
                response["id"],
                self._address
            )
            
            if status["status"] == "success":
                if not status.get("outputSignature"):
                    raise ValueError("Signature is undefined")
                return {"signature": status["outputSignature"]}
            
            if status["status"] == "failed":
                raise ValueError("Signature failed")
            
            time.sleep(2)
    
    def send_transaction(self, transaction: EVMTransaction) -> Dict[str, str]:
        """Send a single transaction."""
        return self._send_batch_of_transactions([transaction])
    
    def send_batch_of_transactions(
        self, transactions: List[EVMTransaction]
    ) -> Dict[str, str]:
        """Send multiple transactions as a batch."""
        return self._send_batch_of_transactions(transactions)
    
    def read(self, request: EVMReadRequest) -> EVMReadResult:
        """Read data from a smart contract.
        
        Args:
            request: Read request parameters including address, ABI, function name and args
            
        Returns:
            Dict containing the result value
            
        Raises:
            ValueError: If ABI is not provided
        """
        address = request.get("address")
        abi = request.get("abi")
        function_name = request.get("functionName")
        args = request.get("args", [])
        
        if not abi:
            raise ValueError("Read request must include ABI for EVM")

        contract = self._w3.eth.contract(
            address=self.resolve_address(address),
            abi=abi
        )

        result = contract.get_function_by_name(function_name)(*args).call()
        
        return {"value": result}
    
    def balance_of(self, address: str, token_address: Optional[str] = None) -> Balance:
        """Get ETH balance of an address."""
        # TODO: Add support for querying token balances via Crossmint API
        if token_address:
            return super().balance_of(address, token_address)

        resolved = self.resolve_address(address)
        balance = self._w3.eth.get_balance(w3_sync.to_checksum_address(resolved))
        
        return {
            "decimals": 18,
            "symbol": "ETH",
            "name": "Ethereum",
            "value": str(w3_sync.from_wei(balance, "ether")),
            "in_base_units": str(balance)
        }
    
    def _send_batch_of_transactions(
        self, transactions: List[EVMTransaction]
    ) -> Dict[str, str]:
        """Internal method to send batch transactions."""
        transaction_data = [
            build_transaction_data(
                tx["to"],
                tx.get("abi"),
                tx.get("functionName"),
                tx.get("args"),
                tx.get("value", 0)
            )
            for tx in transactions
        ]
        
        response = self._client.create_transaction_for_smart_wallet(
            self._address,
            transaction_data,
            self._chain,
            None if self.has_custodial_signer else Account.from_key(cast(KeyPairSigner, self._signer)["secretKey"]).address
        )
        
        if not self.has_custodial_signer:
            if not self.secret_key:
                raise ValueError("Signer account is not available")
            
            user_op_hash = response["approvals"]["pending"][0]["message"]
            if not user_op_hash:
                raise ValueError("User operation hash is not available")
            
            account = self._w3.eth.account.from_key(self.secret_key)
            signature = account.sign_message(
                encode_defunct(hexstr=user_op_hash)
            ).signature.hex()
            
            self._client.approve_transaction(
                self._locator,
                response["id"],
                approvals=[{
                    "signature": signature,
                    "signer": f"evm-keypair:{account.address}"
                }]
            )
        
        while True:
            status = self._client.check_transaction_status(
                self._locator,
                response["id"]
            )
            
            if status["status"] in ["success", "failed"]:
                return {
                    "hash": status.get("onChain", {}).get("txId", ""),
                    "status": status["status"]
                }
            
            time.sleep(2)


def get_evm_locator(address: Optional[str] = None, linked_user: Optional[LinkedUser] = None) -> str:
    return get_locator(address, linked_user, "evm-smart-wallet")

def smart_wallet_factory(api_client: CrossmintWalletsAPI):
    def create_smart_wallet(options: Dict) -> EVMSmartWalletClient:
        locator = get_evm_locator(options.get("address"), options.get("linkedUser"))
        wallet = api_client.get_wallet(locator)
        
        return EVMSmartWalletClient(
            wallet["address"],
            api_client,
            options["chain"],
            options["signer"],
            options["provider"],
            options.get("options", {}).get("ensProvider"),
            options.get("tokens"),
            options.get("enable_send", True)
        )
    
    return create_smart_wallet
