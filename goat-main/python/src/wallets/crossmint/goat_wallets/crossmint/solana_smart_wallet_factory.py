from typing import Optional, TypedDict, get_type_hints
from solana.rpc.api import Client as SolanaClient
from .api_client import CrossmintWalletsAPI
from .parameters import AdminSigner, CoreSignerType
from .solana_smart_wallet import SolanaSmartWalletClient, SolanaSmartWalletConfig, SolanaSmartWalletOptions
import sys
import os


class UserLocatorParams(TypedDict, total=False):
    linkedUser: str
    email: str
    phone: str
    userId: str
    twitter: str
    x: str


user_locator_identifier_fields = get_type_hints(UserLocatorParams)


class SolanaSmartWalletCreationParams(UserLocatorParams):
    config: SolanaSmartWalletConfig


class SolanaSmartWalletFactory:
    def __init__(self, api_client: CrossmintWalletsAPI, connection: Optional[SolanaClient] = None):
        self.api_client = api_client
        self.connection = connection
        if not self.connection:
            connection_url = os.getenv("SOLANA_RPC_ENDPOINT", None)
            default_connection_url = "https://api.devnet.solana.com"
            if (connection_url is None):
                print(
                    f"Environment variable SOLANA_RPC_ENDPOINT is not set, using default endpoint: {default_connection_url}", file=sys.stderr)
            self.connection = SolanaClient(connection_url)

    def get_or_create(self, config: SolanaSmartWalletCreationParams, idempotency_key: Optional[str] = None, tokens=None, enable_send=True) -> SolanaSmartWalletClient:
        """Get or create a Solana smart wallet.
        
        Args:
            config: Wallet configuration parameters
            idempotency_key: Optional idempotency key for wallet creation
            tokens: List of token configurations
            enable_send: Whether to enable send functionality
            
        Returns:
            A Solana smart wallet client instance
            
        Raises:
            ValueError: If connection is not set
            Exception: If wallet creation fails
        """
        if self.connection is None:
            raise ValueError(
                f"Connection is not set, call {self.__class__.__name__}.set_connection(<connection>) first")

        validated_params = self._validate_creation_params(config)
        wallet_locator = self._get_wallet_locator(validated_params["linkedUser"])
        try:
            wallet = self._get_wallet(wallet_locator)
            if wallet:
                print("Wallet found! Returning existing wallet", file=sys.stderr)
            return self._instantiate_wallet(wallet["address"], validated_params["config"]["adminSigner"], tokens, enable_send)
        except Exception as e:
            print("Wallet not found, creating new wallet", file=sys.stderr)

        try:
            wallet = self.api_client.create_wallet(
                "solana-smart-wallet", validated_params["linkedUser"], self._project_config_to_api_params(validated_params["config"]), idempotency_key)
            return self._instantiate_wallet(wallet["address"], validated_params["config"]["adminSigner"], tokens, enable_send)
        except Exception as e:
            raise Exception(
                f"Failed to create wallet: {e}") from e

    def set_connection(self, connection: SolanaClient):
        self.connection = connection

    def _get_wallet(self, wallet_locator: str):
        """Internal method to get wallet."""
        return self.api_client.get_wallet(wallet_locator)

    def _get_linked_user_from_config(self, config: SolanaSmartWalletCreationParams) -> str | None:
        """Internal method to extract linked user from config."""
        present_fields = [
            field for field in user_locator_identifier_fields if field in config]
        if len(present_fields) > 1:
            raise ValueError(
                f"Exactly one identifier field among {user_locator_identifier_fields} must be present. Found: {present_fields}"
            )
        if len(present_fields) == 1:
            present_field = present_fields[0]
            if present_field == "linkedUser":
                return config["linkedUser"]
            return f"{present_fields[0]}:{config[present_fields[0]]}"
        return None

    def _instantiate_wallet(self, address: str, admin_signer: AdminSigner, tokens=None, enable_send=True) -> SolanaSmartWalletClient:
        """Internal method to create wallet instance.
        
        Args:
            address: Wallet address
            admin_signer: Admin signer configuration
            tokens: List of token configurations
            enable_send: Whether to enable send functionality
            
        Returns:
            A Solana smart wallet client instance
        """
        return SolanaSmartWalletClient(
            address,
            self.api_client,
            {"config": {"adminSigner": admin_signer}},
            self.connection,
            tokens,
            enable_send
        )

    def _get_wallet_locator(self, linked_user: str) -> str:
        """Internal method to generate wallet locator."""
        return f"{linked_user}:solana-smart-wallet"

    def _validate_creation_params(self, params: SolanaSmartWalletCreationParams) -> SolanaSmartWalletOptions:
        """Internal method to validate parameters."""
        present_fields = [
            field for field in user_locator_identifier_fields if field in params]

        if len(present_fields) > 1:
            raise ValueError(
                f"At most one identifier among {user_locator_identifier_fields} must be present. Found: {present_fields}"
            )

        return SolanaSmartWalletOptions(
            config=params["config"],
            linkedUser=self._get_linked_user_from_config(params)
        )

    def _project_config_to_api_params(self, config: SolanaSmartWalletConfig):
        admin_signer = config.get("adminSigner")
        if not admin_signer:
            return {}
        type = admin_signer.get("type")
        if type == CoreSignerType.SOLANA_FIREBLOCKS_CUSTODIAL:
            return {
                "adminSigner": {
                    "type": "solana-fireblocks-custodial",
                }
            }
        if type == CoreSignerType.SOLANA_KEYPAIR:
            return {
                "adminSigner": {
                    "type": "solana-keypair",
                    "address": str(config["adminSigner"]["keyPair"].pubkey()),
                }
            }
        raise ValueError(
            f"Invalid admin signer type: {type}")
