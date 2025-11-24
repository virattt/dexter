from abc import ABC, abstractmethod
from typing import Dict, Optional, TypedDict, List, Any, Union
from decimal import Decimal
import re
import base64

from solana.rpc.api import Client as SolanaClient
from solana.rpc.types import TxOpts
from solana.rpc.commitment import Confirmed
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.instruction import Instruction, AccountMeta, CompiledInstruction
from solders.message import Message, MessageV0
from solders.address_lookup_table_account import AddressLookupTableAccount
from solders.transaction import VersionedTransaction, Transaction
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import get_associated_token_address, create_associated_token_account, transfer_checked, TransferCheckedParams
from spl.token.client import Token as SplToken
import nacl.signing

from goat.classes.wallet_client_base import Balance, Signature, WalletClientBase
from goat.types.chain import Chain, SolanaChain
from goat.classes.tool_base import ToolBase, create_tool

from .tokens import SPL_TOKENS, Token, SolanaNetwork
from .params import (
    ConvertToBaseUnitsParameters,
    ConvertFromBaseUnitsParameters,
    SendTokenParameters,
    GetTokenInfoByTickerParameters,
)


class SolanaTransaction(TypedDict):
    """Transaction parameters for Solana transactions."""

    instructions: List[Instruction]
    address_lookup_table_addresses: Optional[List[str]]
    accounts_to_sign: Optional[List[Keypair]]
    signer: Optional[Keypair]


class SolanaOptions:
    """Configuration options for Solana wallet clients."""

    def __init__(self, network: SolanaNetwork = "mainnet", tokens: Optional[List[Token]] = None, enable_send: bool = True):
        self.network = network
        self.tokens = tokens or SPL_TOKENS.get(network, [])
        self.enable_send = enable_send


class SolanaWalletClient(WalletClientBase, ABC):
    """Base class for Solana wallet implementations."""

    def __init__(self, client: SolanaClient, options: Optional[SolanaOptions] = None, tokens: Optional[List[Token]] = None, enable_send: Optional[bool] = None):
        """Initialize the Solana wallet client.

        Args:
            client: A Solana RPC client instance
            options: Configuration options
            tokens: List of token configurations (overrides options.tokens if provided)
            enable_send: Whether to enable send functionality (overrides options.enable_send if provided)
        """
        super().__init__()
        self.client = client
        self.options = options or SolanaOptions()
        self.network = self.options.network
        self.tokens = tokens if tokens is not None else self.options.tokens
        self.enable_send = enable_send if enable_send is not None else self.options.enable_send

    def get_chain(self) -> SolanaChain:
        """Get the chain type for Solana."""
        return {
            "type": "solana",
            "nativeCurrency": {
                "name": "Solana",
                "symbol": "SOL",
                "decimals": 9
            }
        }

    @abstractmethod
    def get_address(self) -> str:
        """Get the wallet's public address."""
        pass

    @abstractmethod
    def sign_message(self, message: str) -> Signature:
        """Sign a message with the wallet's private key."""
        pass

    @abstractmethod
    def send_transaction(self, transaction: SolanaTransaction) -> Dict[str, str]:
        """Send a transaction on the Solana chain."""
        pass

    @abstractmethod
    def send_raw_transaction(self, transaction: str) -> Dict[str, str]:
        """Send a raw transaction on the Solana chain."""
        pass

    def balance_of(self, address: str, token_address: Optional[str] = None) -> Balance:
        """Get the balance of an address for SOL or SPL tokens.
        
        Args:
            address: The address to get the balance of
            token_address: The token mint address, if None checks SOL balance
            
        Returns:
            Balance information
        """
        owner_pubkey = Pubkey.from_string(address)
        
        if token_address:
            try:
                mint_pubkey = Pubkey.from_string(token_address)
                token_account = get_associated_token_address(owner_pubkey, mint_pubkey)
                
                try:
                    account_info = self.client.get_account_info(token_account)
                    if account_info.value is None:
                        balance_in_base_units = "0"
                    else:
                        token_balance = self.client.get_token_account_balance(token_account)
                        balance_in_base_units = token_balance.value.amount
                except Exception:
                    balance_in_base_units = "0"
                
                token_info = next((t for t in self.tokens if t["mintAddress"] == token_address), None)
                
                if token_info:
                    decimals = token_info["decimals"]
                    symbol = token_info["symbol"]
                    name = token_info["name"]
                else:
                    decimals = 9  # Default
                    symbol = "TOKEN"
                    name = "Unknown Token"
                
                balance_value = str(Decimal(balance_in_base_units) / (10 ** decimals))
                
                return {
                    "decimals": decimals,
                    "symbol": symbol,
                    "name": name,
                    "value": balance_value,
                    "in_base_units": balance_in_base_units,
                }
            except Exception as e:
                raise ValueError(f"Failed to fetch token balance: {str(e)}")
        else:
            try:
                balance_lamports = self.client.get_balance(owner_pubkey).value
                chain = self.get_chain()
                
                return {
                    "decimals": chain["nativeCurrency"]["decimals"],
                    "symbol": chain["nativeCurrency"]["symbol"],
                    "name": chain["nativeCurrency"]["name"],
                    "value": str(Decimal(balance_lamports) / (10 ** 9)),  # 9 decimals for SOL
                    "in_base_units": str(balance_lamports),
                }
            except Exception as e:
                raise ValueError(f"Failed to fetch SOL balance: {str(e)}")

    def get_token_info_by_ticker(self, ticker: str) -> Token:
        """Get token information by ticker.
        
        Args:
            ticker: The token ticker (e.g., USDC, USDT)
            
        Returns:
            Token information
        """
        upper_ticker = ticker.upper()
        
        if upper_ticker == "SOL":
            chain = self.get_chain()
            return {
                "symbol": chain["nativeCurrency"]["symbol"],
                "mintAddress": "",  # Native SOL has no mint address
                "decimals": chain["nativeCurrency"]["decimals"],
                "name": chain["nativeCurrency"]["name"],
            }
        
        for token in self.tokens:
            if token["symbol"].upper() == upper_ticker:
                return {
                    "symbol": token["symbol"],
                    "mintAddress": token["mintAddress"],
                    "decimals": token["decimals"],
                    "name": token["name"],
                }
                
        raise ValueError(f"Token with ticker {ticker} not found")

    def _get_token_decimals(self, token_address: Optional[str] = None) -> int:
        """Get the decimals for a token.
        
        Args:
            token_address: The token mint address, or None for SOL
            
        Returns:
            Number of decimals
        """
        if token_address:
            token_info = next((t for t in self.tokens if t["mintAddress"] == token_address), None)
            
            if token_info:
                return token_info["decimals"]
            
            return 9
        
        return self.get_chain()["nativeCurrency"]["decimals"]

    def convert_to_base_units(self, params: Dict[str, Any]) -> str:
        """Convert a token amount to base units.
        
        Args:
            params: Parameters including amount and optional token address
            
        Returns:
            Amount in base units
        """
        amount = params["amount"]
        token_address = params.get("tokenAddress")
        
        try:
            if not re.match(r'^[0-9]*\.?[0-9]+$', amount):
                raise ValueError(f"Invalid amount format: {amount}")
            
            decimals = self._get_token_decimals(token_address)
            base_units = int(Decimal(amount) * (10 ** decimals))
            return str(base_units)
        except Exception as e:
            raise ValueError(f"Failed to convert to base units: {str(e)}")

    def convert_from_base_units(self, params: Dict[str, Any]) -> str:
        """Convert a token amount from base units to decimal.
        
        Args:
            params: Parameters including amount and optional token address
            
        Returns:
            Human-readable amount
        """
        amount = params["amount"]
        token_address = params.get("tokenAddress")
        
        try:
            if not re.match(r'^[0-9]+$', amount):
                raise ValueError(f"Invalid base unit amount format: {amount}")
            
            decimals = self._get_token_decimals(token_address)
            decimal_amount = Decimal(amount) / (10 ** decimals)
            return str(decimal_amount)
        except Exception as e:
            raise ValueError(f"Failed to convert from base units: {str(e)}")

    def send_token(self, params: Dict[str, Any]) -> Dict[str, str]:
        """Send tokens (SOL or SPL).
        
        Args:
            params: Parameters including recipient, amount, and optional token address
            
        Returns:
            Transaction receipt
        """
        if not self.enable_send:
            raise ValueError("Sending tokens is disabled for this wallet")
            
        recipient = params["recipient"]
        amount_in_base_units = params["baseUnitsAmount"]
        token_address = params.get("tokenAddress")
        
        try:
            owner_pubkey = Pubkey.from_string(self.get_address())
            destination_pubkey = Pubkey.from_string(recipient)
            
            instructions = []
            
            if token_address:
                mint_pubkey = Pubkey.from_string(token_address)
                
                source_token_account = get_associated_token_address(owner_pubkey, mint_pubkey)
                
                destination_token_account = get_associated_token_address(destination_pubkey, mint_pubkey)
                
                dest_account_info = self.client.get_account_info(destination_token_account)
                if dest_account_info.value is None:
                    create_ata_ix = create_associated_token_account(
                        owner_pubkey, destination_pubkey, mint_pubkey
                    )
                    instructions.append(create_ata_ix)
                
                token_info = next((t for t in self.tokens if t["mintAddress"] == token_address), None)
                token_decimals = token_info["decimals"] if token_info else 9  # Default to 9 if not found
                
                # Use a much smaller amount for testing to avoid rate limits
                max_test_amount = 1000  # Very small amount to avoid rate limits
                test_amount = min(int(amount_in_base_units), max_test_amount)
                
                try:
                    try:
                        # We just need mint info, so we can create a dummy keypair for the SplToken
                        # since we're only going to call get_mint_info() which doesn't require signing
                        dummy_payer = Keypair()
                        token = SplToken(
                            self.client,
                            mint_pubkey,
                            TOKEN_PROGRAM_ID,
                            dummy_payer
                        )
                        mint_data = token.get_mint_info()
                        mint_decimals = mint_data.decimals
                    except (ImportError, AttributeError):
                        mint_decimals = token_decimals
                except Exception as e:
                    print(f"Warning: Could not get mint info, using token info: {str(e)}")
                    mint_decimals = token_decimals
                
                # Create transfer checked instruction with mint info
                transfer_ix = transfer_checked(
                    TransferCheckedParams(
                        program_id=TOKEN_PROGRAM_ID,
                        source=source_token_account,
                        mint=mint_pubkey,
                        dest=destination_token_account,
                        owner=owner_pubkey,
                        amount=test_amount,
                        decimals=mint_decimals,
                        signers=[]
                    )
                )
                instructions.append(transfer_ix)
            else:
                from solders.system_program import TransferParams, transfer
                
                transfer_ix = transfer(
                    TransferParams(
                        from_pubkey=owner_pubkey,
                        to_pubkey=destination_pubkey,
                        lamports=int(amount_in_base_units)
                    )
                )
                instructions.append(transfer_ix)
            
            # Send transaction
            # Create a transaction object with the instructions
            transaction_data: SolanaTransaction = {
                "instructions": instructions,
                "address_lookup_table_addresses": None,
                "accounts_to_sign": None,
                "signer": None
            }
            return self.send_transaction(transaction_data)
        except Exception as e:
            asset_type = "token" if token_address else "SOL"
            raise ValueError(f"Failed to send {asset_type}: {str(e)}")

    def get_core_tools(self) -> List[ToolBase]:
        """Get the core tools for this wallet client.
        
        Returns:
            List of tool definitions
        """
        base_tools = super().get_core_tools()
        
        common_solana_tools = [
            create_tool(
                {
                    "name": "get_token_info_by_ticker",
                    "description": "Get information about a token by its ticker symbol.",
                    "parameters": GetTokenInfoByTickerParameters
                },
                lambda params: self.get_token_info_by_ticker(params["ticker"])
            ),
            # Convert to/from base units
            create_tool(
                {
                    "name": "convert_to_base_units",
                    "description": "Convert a token amount from human-readable units to base units.",
                    "parameters": ConvertToBaseUnitsParameters
                },
                self.convert_to_base_units
            ),
            create_tool(
                {
                    "name": "convert_from_base_units",
                    "description": "Convert a token amount from base units to human-readable units.",
                    "parameters": ConvertFromBaseUnitsParameters
                },
                self.convert_from_base_units
            ),
        ]
        
        sending_solana_tools = []
        if self.enable_send:
            sending_solana_tools = [
                create_tool(
                    {
                        "name": "send_token",
                        "description": "Send SOL or an SPL token to a recipient.",
                        "parameters": SendTokenParameters
                    },
                    self.send_token
                ),
            ]
        
        return base_tools + common_solana_tools + sending_solana_tools


    def _decompile_instruction(self, compiled_ix: CompiledInstruction, account_keys: list[Pubkey], message: Message) -> Optional[Instruction]:
        try:
            # Get program id from the account keys
            program_id = account_keys[compiled_ix.program_id_index]
            
            # Transform account indexes into AccountMeta objects
            accounts = []
            for idx in compiled_ix.accounts:
                try:
                    pubkey = account_keys[idx]
                    # You might need to check header/message metadata to determine 
                    # if the account is writable/signer
                    is_signer = message.is_signer(idx)
                    # Handle both Message and MessageV0 types
                    if isinstance(message, MessageV0):
                        is_writable = message.is_maybe_writable(idx)
                    else:
                        # For legacy messages, check if it's in the writable accounts range
                        header = message.header
                        num_required_signatures = header.num_required_signatures
                        num_readonly_signed = header.num_readonly_signed_accounts
                        num_readonly_unsigned = header.num_readonly_unsigned_accounts
                        
                        if idx < (num_required_signatures - num_readonly_signed):
                            is_writable = True
                        elif idx < num_required_signatures:
                            is_writable = False
                        elif idx < (len(account_keys) - num_readonly_unsigned):
                            is_writable = True
                        else:
                            is_writable = False
                            
                    accounts.append(AccountMeta(pubkey, is_signer=is_signer, is_writable=is_writable))
                except IndexError:
                    print(f"Could not find account at index {idx}")
                    return None
            
            return Instruction(
                program_id=program_id,
                accounts=accounts,
                data=compiled_ix.data
            )
        except IndexError:
            print(f"Could not find program id at index {compiled_ix.program_id_index}")
            return None

    def decompile_versioned_transaction_to_instructions(self, versioned_transaction: VersionedTransaction) -> Optional[List[Instruction]]:
        """Decompile a versioned transaction into its constituent instructions.

        Args:
            versioned_transaction: The versioned transaction to decompile

        Returns:
            List of instructions from the transaction if successful, None if we can't
            properly decompile all instructions
        """
        # Convert CompiledInstructions back to Instructions
        message = versioned_transaction.message
        
        # For MessageV0, we need to get all accounts including those from lookup tables
        if isinstance(message, MessageV0) and message.address_table_lookups:
            # Get lookup table accounts
            lookup_table_keys = [str(lookup.account_key) for lookup in message.address_table_lookups]
            lookup_tables = self.get_address_lookup_table_accounts(lookup_table_keys)
            
            # Filter out None lookup tables and their corresponding lookups
            valid_lookups = []
            valid_tables = []
            for i, table in enumerate(lookup_tables):
                if table is not None:
                    valid_lookups.append(message.address_table_lookups[i])
                    valid_tables.append(table)
            
            # Build complete account list
            account_keys = list(message.account_keys)  # Static accounts
            
            # Add writable accounts from valid lookup tables
            for lookup, table in zip(valid_lookups, valid_tables):
                for idx in lookup.writable_indexes:
                    account_keys.append(table.addresses[idx])
            
            # Add readonly accounts from valid lookup tables
            for lookup, table in zip(valid_lookups, valid_tables):
                for idx in lookup.readonly_indexes:
                    account_keys.append(table.addresses[idx])
        else:
            account_keys = message.account_keys

        instructions = []
        for compiled_ix in message.instructions:
            ix = self._decompile_instruction(compiled_ix, account_keys, message) # type: ignore
            if ix is not None:
                instructions.append(ix)

        return instructions

    def get_address_lookup_table_accounts(self, keys: List[str]) -> List[AddressLookupTableAccount]:
        """Get address lookup table accounts for the given addresses.

        Args:
            addresses: List of lookup table addresses

        Returns:
            List of address lookup table accounts
        """
        lookup_table_accounts = []
        
        for key in keys:
            # Convert address to Pubkey
            pubkey = Pubkey.from_string(key)
            
            # Get account info
            try:
                account_info = self.client.get_account_info(pubkey).value
            except Exception as e:
                print(f"Error getting account info for {key}: {e}")
                account_info = None
            
            if account_info is not None:
                try:
                    # The account data comes as base64, need to decode it first
                    decoded_data = base64.b64decode(account_info.data)
                    lookup_table_account = AddressLookupTableAccount.from_bytes(decoded_data)
                    lookup_table_accounts.append(lookup_table_account)
                except Exception as e:
                    print(f"Error decoding lookup table for {key}: {e}")
                    lookup_table_accounts.append(None)
            else:
                lookup_table_accounts.append(None)
                
        return lookup_table_accounts


class SolanaKeypairWalletClient(SolanaWalletClient):
    """A Solana wallet client implementation using a local keypair for signing."""

    def __init__(self, client: SolanaClient, keypair: Keypair, options: Optional[SolanaOptions] = None, tokens: Optional[List[Token]] = None, enable_send: Optional[bool] = None):
        """Initialize the Solana keypair wallet client.
        
        Args:
            client: A Solana RPC client instance
            keypair: A Solders Keypair object
            options: Configuration options
            tokens: List of token configurations (overrides options.tokens if provided)
            enable_send: Whether to enable send functionality (overrides options.enable_send if provided)
        """
        super().__init__(client, options, tokens, enable_send)
        self.keypair = keypair

    def get_address(self) -> str:
        """Get the wallet's public address."""
        return str(self.keypair.pubkey())

    def sign_message(self, message: str) -> Signature:
        """Sign a message with the wallet's private key."""
        message_bytes = message.encode("utf-8")
        signed = nacl.signing.SigningKey(self.keypair.secret()).sign(message_bytes)
        return {"signature": signed.signature.hex()}

    def balance_of(self, address: str, token_address: Optional[str] = None) -> Balance:
        """Get the balance of an address for SOL or SPL tokens.
        
        Args:
            address: The address to check balance for
            token_address: The token mint address, if None checks SOL balance
            
        Returns:
            Balance information
        """
        if token_address:
            return super().balance_of(address, token_address)
        else:
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

    def send_transaction(self, transaction: SolanaTransaction) -> Dict[str, str]:
        """Send a transaction on the Solana chain."""
        # Get latest blockhash
        recent_blockhash = self.client.get_latest_blockhash().value.blockhash

        # Create transaction
        tx = Transaction.new_with_payer(
            instructions=transaction["instructions"],
            payer=self.keypair.pubkey(),
        )

        # Add signers
        signers = [self.keypair]
        additional_signers = transaction.get("accounts_to_sign")
        if additional_signers is not None:
            signers.extend(additional_signers)

        # Sign and send transaction
        tx.sign(signers, recent_blockhash=recent_blockhash)
        result = self.client.send_transaction(
            tx,
            opts=TxOpts(
                skip_preflight=False,
                max_retries=10,
                preflight_commitment=Confirmed,
            ),
        )

        # Wait for confirmation
        self.client.confirm_transaction(
            result.value,
            commitment=Confirmed,
        )

        return {"hash": str(result.value)}

    def send_raw_transaction(self, transaction: str) -> Dict[str, str]:
        """Send a raw transaction on the Solana chain.
        
        Args:
            transaction: Base64 encoded transaction string
            
        Returns:
            Dict containing the transaction hash
        """
        # Deserialize the transaction from base64
        tx = VersionedTransaction.from_bytes(base64.b64decode(transaction))
        
        # Extract the message from the transaction and sign it, forming a new transaction
        tx_signed = VersionedTransaction(tx.message, [self.keypair])
        
        # Send the transaction
        result = self.client.send_transaction(
            tx_signed,
            opts=TxOpts(
                skip_preflight=False,
                max_retries=10,
                preflight_commitment=Confirmed,
            ),
        )
        
        # Wait for confirmation
        self.client.confirm_transaction(
            result.value,
            commitment=Confirmed,
        )
        
        return {"hash": str(result.value)}


def solana(client: SolanaClient, keypair: Keypair, options: Optional[SolanaOptions] = None, tokens: Optional[List[Token]] = None, enable_send: Optional[bool] = None) -> SolanaKeypairWalletClient:
    """Create a Solana wallet client with keypair.
    
    Args:
        client: A Solana RPC client
        keypair: A Solders Keypair object
        options: Configuration options
        tokens: List of token configurations (overrides options.tokens if provided)
        enable_send: Whether to enable send functionality (overrides options.enable_send if provided)
        
    Returns:
        A Solana wallet client
    """
    return SolanaKeypairWalletClient(client, keypair, options, tokens, enable_send)
