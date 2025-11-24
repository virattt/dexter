from time import sleep
from typing import Dict, List, Optional, Any, TypedDict, Union
import base58
import base64
import nacl.signing
from solders.instruction import Instruction
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.null_signer import NullSigner
from solders.message import Message
from solana.rpc.api import Client as SolanaClient
from solders.transaction import VersionedTransaction
from goat.classes.wallet_client_base import Signature
from goat_wallets.solana import SolanaWalletClient, SolanaTransaction
from .api_client import CrossmintWalletsAPI
from .parameters import SolanaSmartWalletTransactionParams
from .base_wallet import BaseWalletClient, get_locator
from .types import LinkedUser, SolanaFireblocksSigner, SolanaKeypairSigner, SupportedToken, UnsupportedOperationException
from goat.classes.wallet_client_base import Balance

class SolanaSmartWalletConfig(TypedDict):
    """Configuration specific to Solana smart wallets."""
    adminSigner: Union[SolanaKeypairSigner, SolanaFireblocksSigner]


class SolanaSmartWalletOptions(TypedDict):
    """Options specific to Solana smart wallets."""
    config: SolanaSmartWalletConfig
    linkedUser: str


class SolanaSmartWalletOptionsWithLinkedUser(TypedDict):
    connection: SolanaClient
    config: SolanaSmartWalletConfig
    linkedUser: LinkedUser


class SolanaSmartWalletOptionsWithAddress(TypedDict):
    connection: SolanaClient
    config: SolanaSmartWalletConfig
    address: str


class TransactionApproval(TypedDict):
    signer: str
    signature: Optional[str]


class SolanaSmartWalletClient(SolanaWalletClient, BaseWalletClient):
    def __init__(
        self,
        address: str,
        api_client: CrossmintWalletsAPI,
        options: SolanaSmartWalletOptions,
        connection: SolanaClient = SolanaClient(
            "https://api.devnet.solana.com"),
        tokens = None,
        enable_send = True
    ):
        """Initialize Solana smart wallet client.
        
        Args:
            address: Wallet address
            api_client: Crossmint API client
            options: Wallet configuration options
            connection: Solana RPC client
            tokens: List of token configurations
            enable_send: Whether to enable send functionality
        """
        SolanaWalletClient.__init__(self, connection, None, tokens, enable_send)
        BaseWalletClient.__init__(self, address, api_client, "solana")
        self._locator = get_locator(address, None, "solana-smart-wallet")
        self._admin_signer = options["config"]["adminSigner"]
        if self._admin_signer["type"] == "solana-keypair":
            self._admin_signer["address"] = str(self._admin_signer['keyPair'].pubkey())

    def get_address(self) -> str:
        return self._address

    def sign_message(
        self,
        message: str,
        required_signers: Optional[List[str]] = None,
        signer: Optional[str] = None
    ) -> Signature:
        raise UnsupportedOperationException(
            "Sign message is not supported for Solana smart wallets")

    def send_transaction(
        self,
        transaction: SolanaTransaction,
        additional_signers: List[Keypair] = []
    ) -> Dict[str, str]:
        instructions = []
        for instruction in transaction["instructions"]:
            instruction = Instruction(
                program_id=instruction.program_id,
                accounts=instruction.accounts,
                data=instruction.data
            )
            instructions.append(instruction)

        message = Message(
            instructions=instructions,
            payer=Pubkey.from_string(self._address)
        )
        versioned_transaction = VersionedTransaction(
            message,
            [NullSigner(Pubkey.from_string(self._address))] +
            [NullSigner(signer.pubkey()) for signer in additional_signers]
        )

        serialized = base58.b58encode(bytes(versioned_transaction)).decode()
        signer = transaction.get("signer", None)

        if signer is None and self._admin_signer["type"] == "solana-keypair":
            signer = self._admin_signer["keyPair"]

        return self.send_raw_transaction(serialized, additional_signers, signer)
    
    def balance_of(self, address: str, token_address: Optional[str] = None) -> Balance:
        # TODO: Add support for querying token balances via Crossmint API
        if token_address:
            return super().balance_of(address, token_address)

        pubkey = Pubkey.from_string(address)
        balance_lamports = self.client.get_balance(pubkey).value
        # Convert lamports (1e9 lamports in 1 SOL)
        return {
            "decimals": 9,
            "symbol": "SOL",
            "name": "Solana",
            "value": str(balance_lamports / 10**9),
            "in_base_units": str(balance_lamports),
        }

    def handle_approvals(
        self,
        transaction_id: str,
        pending_approvals: List[Dict[str, str]],
        signers: List[Keypair]
    ) -> None:
        """Send approval signatures for a pending transaction.

        Args:
            transaction_id: The ID of the transaction to approve
            pending_approvals: The pending approvals
            signers: The signers to approve the transaction

        Raises:
            ValueError: If signature generation or approval submission fails
        """
        try:
            approvals = []
            for pending_approval in pending_approvals:
                signer = next(
                    (s for s in signers if str(s.pubkey())
                     in pending_approval["signer"]),
                    None
                )
                if not signer:
                    raise ValueError(
                        f"Signer not found for approval: {pending_approval['signer']}. Available signers: {[str(s.pubkey()) for s in signers]}")
                signature = signer.sign_message(
                    base58.b58decode(pending_approval["message"]))
                encoded_signature = base58.b58encode(
                    signature.to_bytes()).decode()
                approvals.append({
                    "signer": "solana-keypair:" + base58.b58encode(bytes(signer.pubkey())).decode(),
                    "signature": encoded_signature
                })

            self._client.approve_transaction(
                self._locator,
                transaction_id,
                approvals=approvals
            )
        except Exception as e:
            raise ValueError(f"Failed to send transaction approval: {str(e)}")

    def handle_transaction_flow(
        self,
        transaction_id: str,
        signers: List[Keypair],
        error_prefix: str = "Transaction"
    ) -> Dict[str, Any]:
        """Handle the transaction approval flow and monitor transaction status until completion.

        Args:
            transaction_id: The ID of the transaction to monitor
            signers: Array of keypairs that can be used for signing approvals
            error_prefix: Prefix for error messages

        Returns:
            The successful transaction data

        Raises:
            ValueError: If the transaction fails or remains in awaiting-approval state
        """
        # Check initial transaction status
        status = self._client.check_transaction_status(
            self._locator,
            transaction_id
        )

        # Handle approvals if needed
        if status["status"] == "awaiting-approval":
            pending_approvals = status["approvals"]["pending"]
            if pending_approvals:
                self.handle_approvals(
                    transaction_id,
                    pending_approvals,
                    signers
                )

        # Wait for transaction success
        while status["status"] != "success":
            status = self._client.check_transaction_status(
                self._locator,
                transaction_id
            )

            if status["status"] == "failed":
                error = status.get("error", {})
                raise ValueError(f"{error_prefix} failed: {error}")

            if status["status"] == "awaiting-approval":
                raise ValueError(
                    f"{error_prefix} still awaiting approval after submission")

            if status["status"] == "success":
                break

            sleep(1)

        return status

    def send_raw_transaction(
        self,
        transaction: str,
        additional_signers: List[Keypair] = [],
        signer: Optional[Keypair] = None,
        required_signers: Optional[List[str]] = None,
    ) -> Dict[str, str]:
        transaction = self.parse_serialized_transaction(transaction)

        if signer:
            resolved_signer = signer
        elif self._admin_signer["type"] == "solana-keypair":
            resolved_signer = self._admin_signer["keyPair"]
        else:
            resolved_signer = None

        params = SolanaSmartWalletTransactionParams(
            transaction=transaction,
            required_signers=required_signers,
            signer=f"solana-keypair:{base58.b58encode(bytes(resolved_signer.pubkey())).decode()}" if resolved_signer else None
        )
        try:
            response = self._client.create_transaction_for_smart_wallet(
                self._address,
                params,
            )

            # Prepare signers array
            signers = list(additional_signers)
            if self._admin_signer["type"] == "solana-keypair":
                signers.append(self._admin_signer["keyPair"])
            if resolved_signer:
                signers.append(resolved_signer)

            # Handle transaction flow
            completed_transaction = self.handle_transaction_flow(
                response["id"],
                signers
            )

            return {
                "hash": completed_transaction.get("onChain", {}).get("txId", "")
            }

        except Exception as e:
            raise ValueError(
                f"Failed to create or process transaction: {str(e)}")

    def register_delegated_signer(
        self,
        signer: str,
    ) -> Dict[str, Any]:
        """Register a delegated signer for this wallet.

        Args:
            signer: The locator of the delegated signer
            expires_at: Optional expiry date in milliseconds since UNIX epoch

        Returns:
            Delegated signer registration response
        """
        try:
            response = self._client.register_delegated_signer(
                self._locator,
                signer,
            )

            # For Solana non-custodial delegated signers, we need to handle the transaction approval
            if 'transaction' in response and response['transaction']:
                transaction_id = response['transaction']['id']

                # For delegated signer registration, only the admin signer is needed
                signers = []
                if self._admin_signer["type"] == "solana-keypair":
                    signers.append(self._admin_signer["keyPair"])

                # Handle transaction flow
                self.handle_transaction_flow(
                    transaction_id,
                    [self._admin_signer["keyPair"]],
                    "Delegated signer registration"
                )
                return self.get_delegated_signer(response["locator"])
            return response
        except Exception as e:
            raise ValueError(f"Failed to register delegated signer: {str(e)}")

    def get_delegated_signer(self, signer_locator: str) -> Dict[str, Any]:
        """Get information about a delegated signer.

        Args:
            signer_locator: Signer locator string

        Returns:
            Delegated signer information
        """
        return self._client.get_delegated_signer(self._locator, signer_locator)

    def get_admin_signer_address(self) -> str:
        return self._admin_signer["address"]

    def fund_wallet(self, token: SupportedToken, amount: int):
        """Fund the wallet with a specified amount of this token.

        Args:
            amount: The amount of SOL to fund the wallet with
        """
        return self._client.fund_wallet(self._address, token, amount)

    def request_airdrop(self, amount_lamports: int):
        """Request an airdrop for the wallet.

        Args:
            amount: The amount of SOL to fund the wallet with
        """
        return self.client.request_airdrop(Pubkey.from_string(self._address), amount_lamports)

    def parse_serialized_transaction(self, transaction: str) -> str:
        try:
            base58.b58decode(transaction)
            return transaction
        except Exception:
            print("Transaction is not base58 encoded, trying to decode as base64")
            try:
                return base58.b58encode(
                    base64.b64decode(transaction)).decode()
            except Exception:
                raise ValueError(
                    "Transaction is not base58 or base64 encoded")

    @staticmethod
    def derive_address_from_secret_key(secret_key: str) -> str:
        """Derive a Solana address from a base58-encoded secret key.

        Args:
            secret_key: Base58-encoded secret key string

        Returns:
            Base58-encoded public key (address) string

        Raises:
            ValueError: If the secret key is invalid
        """
        try:
            # Decode the base58 secret key
            decoded_key = base58.b58decode(secret_key)

            # Create signing key from bytes
            signing_key = nacl.signing.SigningKey(decoded_key)

            # Get verify key (public key)
            verify_key = signing_key.verify_key

            # Convert to bytes and encode as base58
            public_key_bytes = bytes(verify_key)
            return base58.b58encode(public_key_bytes).decode()
        except Exception as e:
            raise ValueError(f"Invalid secret key: {str(e)}")
