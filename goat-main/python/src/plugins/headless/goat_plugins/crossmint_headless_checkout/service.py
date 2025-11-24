import aiohttp
import json
from typing import Dict, Any

from goat.decorators.tool import Tool
from .parameters import BuyTokenParameters
from goat_wallets.evm import EVMWalletClient
from goat_wallets.solana import SolanaWalletClient

# Import the base wallet client type for proper typing
from goat.classes.wallet_client_base import WalletClientBase

# Minimal imports for EVM transaction parsing (essential for functionality)
import rlp
from eth_utils import to_checksum_address, to_hex


def clean_null_values(obj):
    """Recursively remove null/None values from dictionaries and lists."""
    if isinstance(obj, dict):
        return {k: clean_null_values(v) for k, v in obj.items() if v is not None and v != ""}
    elif isinstance(obj, list):
        return [clean_null_values(item) for item in obj if item is not None and item != ""]
    else:
        return obj


def parse_evm_transaction(serialized_tx: str) -> Dict[str, Any]:
    """Parse EVM transaction to extract to, value, and data (handles legacy and EIP-1559)."""
    if not serialized_tx.startswith("0x"):
        serialized_tx = f"0x{serialized_tx}"
    
    raw_bytes = bytes.fromhex(serialized_tx[2:])
    
    # Check if it's a typed transaction (EIP-1559, EIP-2930, etc.)
    if raw_bytes[0] <= 0x7f:  # Typed transaction
        tx_type = raw_bytes[0]
        print(f"Detected typed transaction: type {tx_type}")
        
        if tx_type == 0x02:  # EIP-1559
            # Remove type byte and decode the rest
            rlp_data = raw_bytes[1:]
            decoded = rlp.decode(rlp_data)
            
            # EIP-1559 format: [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, yParity, r, s]
            if len(decoded) >= 8:
                to_bytes = decoded[5]      # to at position 5
                value_bytes = decoded[6]   # value at position 6  
                data_bytes = decoded[7]    # data at position 7
                
                return {
                    "to": to_checksum_address(to_bytes) if to_bytes else None,
                    "value": int.from_bytes(value_bytes, 'big') if value_bytes else 0,
                    "data": to_hex(data_bytes) if data_bytes else "0x"
                }
        else:
            raise Exception(f"Unsupported transaction type: {tx_type}")
    else:
        # Legacy transaction
        print("Detected legacy transaction")
        decoded = rlp.decode(raw_bytes)
        
        # Legacy format: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
        if len(decoded) >= 6:
            to_bytes = decoded[3]      # to at position 3
            value_bytes = decoded[4]   # value at position 4
            data_bytes = decoded[5]    # data at position 5
            
            return {
                "to": to_checksum_address(to_bytes) if to_bytes else None,
                "value": int.from_bytes(value_bytes, 'big') if value_bytes else 0,
                "data": to_hex(data_bytes) if data_bytes else "0x"
            }
    
    raise Exception("Invalid transaction format")


class CrossmintApiClient:
    PRODUCTION_URL = "https://www.crossmint.com"
    STAGING_URL = "https://staging.crossmint.com"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = self._get_base_url(api_key)

    def _get_base_url(self, api_key: str) -> str:
        """Determine the base URL based on the API key format"""
        if api_key.startswith("sk_staging_"):
            return self.STAGING_URL
        else:
            return self.PRODUCTION_URL

    async def post(self, path: str, body: Dict[str, Any]):
        """Make a POST request to the Crossmint API"""
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.base_url}{path}", headers=headers, json=body) as response:
                if not response.ok:
                    error_text = await response.text()
                    raise Exception(f"HTTP error! status: {response.status} {error_text}")
                return await response.json()


class CrossmintHeadlessCheckoutService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_client = CrossmintApiClient(api_key)

    @Tool({
        "description": "Buy a token such as an NFT, SFT or item tokenized by them, listed on any blockchain",
        "parameters_schema": BuyTokenParameters
    })
    async def buy_token(self, wallet_client: WalletClientBase, parameters: dict):
        """Purchase a token or product via the Crossmint API."""
        try:
            # Ensure locale is set if not provided
            if "locale" not in parameters:
                parameters["locale"] = "en-US"

            # Convert parameters to JSON-serializable dict and clean null values
            api_request = clean_null_values(parameters)

            # Debug: show the API request being sent
            print(f"\n=== CROSSMINT API REQUEST ===")
            print(f"Endpoint: /api/2022-06-09/orders")
            print(f"Request body: {json.dumps(api_request, indent=2)}")
            print("============================\n")

            # Call the Crossmint API to create the order
            response_data = await self.api_client.post("/api/2022-06-09/orders", api_request)

            order = response_data.get("order")
            if not order:
                raise Exception("No order returned from API")

            # Check for insufficient funds
            if order.get("payment", {}).get("status") == "crypto-payer-insufficient-funds":
                raise Exception("Insufficient funds")

            # Check if physical address is required
            if order.get("quote", {}).get("status") == "requires-physical-address":
                raise Exception("recipient.physicalAddress is required")

            # Get the serialized transaction
            serialized_transaction = order.get("payment", {}).get("preparation", {}).get("serializedTransaction")
            if not serialized_transaction:
                raise Exception("No serialized transaction found for order, this item may not be available for purchase")

            # Debug: show what we got from Crossmint
            print(f"\n=== TRANSACTION DEBUG ===")
            print(f"Serialized transaction: {serialized_transaction[:100]}...")
            print(f"Transaction length: {len(serialized_transaction)}")
            print(f"Starts with 0x: {serialized_transaction.startswith('0x')}")
            if serialized_transaction.startswith('0x') and len(serialized_transaction) > 2:
                first_byte = serialized_transaction[2:4]
                print(f"First byte: {first_byte} (indicates transaction type)")
            print("=========================\n")

            # Process based on payment method
            payment_method = order.get("payment", {}).get("method")

            # Handle Solana transactions
            if payment_method == "solana":
                if not isinstance(wallet_client, SolanaWalletClient):
                    raise Exception("Solana wallet client required. Use a solana wallet client, or change the payment method to one supported by your wallet client")

                # Send the raw transaction using Solana wallet
                result = wallet_client.send_raw_transaction(serialized_transaction)
                return {"order": order, "txId": result["hash"]}

            # Handle EVM transactions
            if self._is_evm_blockchain(payment_method):
                if not isinstance(wallet_client, EVMWalletClient):
                    raise Exception("EVM wallet client required. Use an evm wallet client, or change the payment method to one supported by your wallet client")

                # Parse the raw transaction (essential for EVM compatibility)
                parsed_tx = parse_evm_transaction(serialized_transaction)
                
                if not parsed_tx["to"]:
                    raise Exception("Transaction to address is required")

                transaction_params = {
                    "to": parsed_tx["to"],
                    "value": parsed_tx["value"],
                    "data": parsed_tx["data"]
                }
                
                result = wallet_client.send_transaction(transaction_params)
                return {"order": order, "txId": result["hash"]}

            # Unsupported payment method
            raise Exception(f"Unsupported payment method: {payment_method}")

        except Exception as error:
            raise Exception(f"Failed to buy token: {str(error)}")

    def _is_evm_blockchain(self, method: str) -> bool:
        """Check if the payment method is an EVM blockchain."""
        evm_chains = ["ethereum", "ethereum-sepolia", "base", "base-sepolia", "polygon", "polygon-amoy"]
        return method in evm_chains
