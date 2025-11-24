import time
from typing import Dict, List, Any
from abc import ABC, abstractmethod

from pydantic import BaseModel, Field

from multiversx_sdk import MainnetEntrypoint, TestnetEntrypoint, DevnetEntrypoint, Account, Address, Mnemonic, Message, TokenManagementTransactionsOutcomeParser, Token, TokenTransfer

from goat.classes.wallet_client_base import Balance, Signature, WalletClientBase, BalanceParams
from goat.types.chain import Chain
from goat.classes.tool_base import ToolBase, create_tool

from .types import MultiversXTransactionStatus, MultiversXTransaction


class TokensBalance(BaseModel):
    tokens: List[Any]


class SignMessageParams(BaseModel):
    message: str = Field(description="The message to sign")


class TransactionStatusParams(BaseModel):
    tx_hash: str = Field(description="The transaction hash to check")


class DeployTokenParams(BaseModel):
    token_name: str = Field(description="The name of the token")
    token_ticker: str = Field(description="The ticker of the token")
    initial_supply: str = Field(description="The initial supply of the token")
    num_decimals: str = Field(
        description="The number of decimals of the token")


class MultiversXWalletClient(WalletClientBase, ABC):
    """Base class for MultiversX wallet implementations."""

    def get_chain(self) -> Chain:
        """Get the chain type for MultiversX."""
        return {"type": "multiversx"}

    @abstractmethod
    def get_address(self) -> str:
        """Get the wallet's public address."""
        pass

    @abstractmethod
    def sign_message(self, message: str) -> Signature:
        """Sign a message with the current account."""
        pass

    @abstractmethod
    def balance_of(self, address: str) -> Balance:
        """Get the EGLD balance of an address."""
        pass

    @abstractmethod
    def get_fungible_tokens_balance(self, address: str) -> TokensBalance:
        """Get the fungible tokens (ESDT) balance of an address."""
        pass

    @abstractmethod
    def get_non_fungible_tokens_balance(self, address: str) -> TokensBalance:
        """Get the Non Fungible Tokens (NFTs) balance of an address."""
        pass

    @abstractmethod
    def get_transaction_status(self,
                               tx_hash: str) -> MultiversXTransactionStatus:
        """Get the transaction status from a transaction hash."""
        pass

    @abstractmethod
    def send_transaction(self,
                         transaction: MultiversXTransaction) -> Dict[str, str]:
        """Send a transaction on the MultiversX chain.

        Args:
            transaction: Transaction parameters

        Returns:
            Dict containing the transaction hash
        """
        pass

    @abstractmethod
    def deploy_token(self, token: DeployTokenParams) -> Dict[str, str]:
        """Deploy an ESDT Token on the MultiversX chain.

        Args:
            token: Token parameters

        Returns:
            Dict containing the deployed token
        """
        pass

    def get_core_tools(self) -> List[ToolBase]:
        # Get the base tools from the parent class
        base_tools = super().get_core_tools()

        # Add MultiversX-specific tools
        additional_tools = [
            create_tool(
                {
                    "name": "sign_message",
                    "description": "Sign a message with the current account.",
                    "parameters": SignMessageParams
                },
                lambda parameters: self.sign_message(parameters["message"]),
            ),
            create_tool(
                {
                    "name": "get_transaction_status",
                    "description":
                    "Get the transaction status from a transaction hash.",
                    "parameters": TransactionStatusParams
                },
                lambda parameters: self.get_transaction_status(parameters[
                    "tx_hash"]),
            ),
            create_tool(
                {
                    "name": "get_fungible_tokens_balance",
                    "description":
                    "Get the fungible tokens (ESDT) balance of an address.",
                    "parameters": BalanceParams
                },
                lambda parameters: self.get_fungible_tokens_balance(parameters[
                    "address"]),
            ),
            create_tool(
                {
                    "name": "get_non_fungible_tokens_balance",
                    "description":
                    "Get the Non Fungible Tokens (NFTs) balance of an address.",
                    "parameters": BalanceParams
                },
                lambda parameters: self.get_non_fungible_tokens_balance(
                    parameters["address"]),
            ),
            create_tool(
                {
                    "name": "deploy_token",
                    "description": "Deploy an ESDT Token",
                    "parameters": DeployTokenParams
                },
                lambda parameters: self.deploy_token(parameters),
            ),
        ]

        # Return combined list of tools
        return base_tools + additional_tools


class MultiversXSeedphraseWalletClient(MultiversXWalletClient):
    """MultiversX implementation using a seedphrase."""

    def __init__(self, seed: str, network: str):
        """Initialize the MultiversX seedphrase wallet client.

        Args:
            seed: the seedphrase
            network: The network to connect to (mainnet, testnet, devnet)
        """
        super().__init__()
        mnemonic = Mnemonic(seed)
        self.account = Account.new_from_mnemonic(mnemonic.get_text())

        if network == "mainnet":
            self.entrypoint = MainnetEntrypoint()
            self.explorer_url = "https://explorer.multiversx.com"
        elif network == "devnet":
            self.entrypoint = DevnetEntrypoint()
            self.explorer_url = "https://devnet-explorer.multiversx.com"
        else:
            self.entrypoint = TestnetEntrypoint()
            self.explorer_url = "https://testnet-explorer.multiversx.com"

        self.api = self.entrypoint.create_network_provider()

    def get_address(self) -> str:
        """Get the wallet's public address."""
        return str(self.account.address)

    def sign_message(self, message: str) -> Signature:
        """Sign a message with the current account."""
        if not self.account:
            raise ValueError("No account connected")

        message = Message(data=message.encode(), address=self.account.address)
        message.signature = self.account.sign_message(message)
        return {"signature": message.signature.hex()}

    def balance_of(self, address: str) -> Balance:
        """Get the EGLD balance of an address."""
        address = Address.new_from_bech32(address)
        account = self.api.get_account(address=address)
        balance_lamports = account.balance
        # Convert lamports (1e18 lamports in 1 EGLD)
        return {
            "decimals": 18,
            "symbol": "EGLD",
            "name": "MultiversX",
            "value": str(balance_lamports / 10**18),
            "in_base_units": str(balance_lamports),
        }

    def get_fungible_tokens_balance(self, address: str) -> TokensBalance:
        """Get the fungible tokens (ESDT) balance of an address."""
        address = Address.new_from_bech32(address)
        fungible_tokens = self.api.get_fungible_tokens_of_account(
            address=address)
        return {
            "tokens": fungible_tokens,
        }

    def get_non_fungible_tokens_balance(self, address: str) -> TokensBalance:
        """Get the Non Fungible Tokens (NFTs) balance of an address."""
        address = Address.new_from_bech32(address)
        nfts = self.api.get_non_fungible_tokens_of_account(address=address)
        return {
            "tokens": nfts,
        }

    def get_transaction_status(self,
                               tx_hash: str) -> MultiversXTransactionStatus:
        """Get the transaction status from a transaction hash."""
        transaction_status_obj = self.api.get_transaction(tx_hash).status
        return {
            "status": transaction_status_obj.status,
            "is_completed": transaction_status_obj.is_completed,
            "is_successful": transaction_status_obj.is_successful,
        }

    def send_transaction(self,
                         transaction: MultiversXTransaction) -> Dict[str, str]:
        """Send a transaction on the MultiversX chain."""
        if not self.account:
            raise ValueError("No account connected")

        receiver = Address.new_from_bech32(transaction["receiver"])
        sender = self.account

        # Simple EGLD transfer
        if not transaction.get("contract") and transaction.get(
                "native_amount"):
            factory = self.entrypoint.create_transfers_transactions_factory()

            sender.nonce = self.entrypoint.recall_account_nonce(sender.address)

            transaction = factory.create_transaction_for_transfer(
                sender=sender.address,
                receiver=receiver,
                native_amount=transaction["native_amount"])

            transaction.nonce = sender.get_nonce_then_increment()

            transaction.signature = sender.sign_transaction(transaction)

            tx_hash = self.entrypoint.send_transaction(transaction)
            tx_hash_hex = tx_hash.hex()

            transaction_link = f"{self.explorer_url}/transactions/{tx_hash_hex}"

            return {
                "hash": tx_hash_hex,
                "link": transaction_link,
            }

    def deploy_token(self, token: DeployTokenParams) -> Dict[str, str]:
        """Deploy an ESDT Token on the MultiversX chain"""
        if not self.account:
            raise ValueError("No account connected")

        factory = self.entrypoint.create_token_management_transactions_factory(
        )

        deployer = self.account
        initial_supply = int(token["initial_supply"])
        token_name = token["token_name"]
        token_ticker = token["token_ticker"]
        num_decimals = int(token["num_decimals"])

        transaction = factory.create_transaction_for_issuing_fungible(
            sender=deployer.address,
            token_name=token_name,
            token_ticker=token_ticker,
            initial_supply=initial_supply,
            num_decimals=num_decimals,
            can_freeze=False,
            can_wipe=True,
            can_pause=False,
            can_change_owner=True,
            can_upgrade=True,
            can_add_special_roles=True)

        deployer.nonce = self.entrypoint.recall_account_nonce(deployer.address)
        transaction.nonce = deployer.get_nonce_then_increment()

        transaction.signature = deployer.sign_transaction(transaction)

        tx_hash = self.entrypoint.send_transaction(transaction)

        transaction_on_network = self.entrypoint.await_transaction_completed(
            tx_hash)

        parser = TokenManagementTransactionsOutcomeParser()
        outcome = parser.parse_issue_fungible(transaction_on_network)

        token_identifier = str(outcome[0].token_identifier)

        # Sleep for 10 seconds before getting the token definition
        time.sleep(10)

        fungible_token_definition = self.api.get_definition_of_fungible_token(
            token_identifier=token_identifier)

        return {
            "token": fungible_token_definition,
        }


def multiversx_wallet(seed: str,
                      network: str) -> MultiversXSeedphraseWalletClient:
    """Create a new MultiversXSeedphraseWalletClient instance.

    Args:
        seed: the seedphrase of the wallet
        network: The network to connect to (mainnet, testnet, devnet)

    Returns:
        A new MultiversXSeedphraseWalletClient instance
    """
    return MultiversXSeedphraseWalletClient(seed, network)
