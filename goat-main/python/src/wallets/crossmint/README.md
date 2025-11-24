# Crossmint Wallet Implementation for GOAT SDK

This package provides Crossmint wallet integration for the GOAT SDK, supporting both EVM Smart Wallets and Solana Custodial Wallets.

## Features

-   EVM Smart Wallet support
-   Solana Custodial Wallet support
-   Async API client for Crossmint interactions
-   Support for multiple authentication methods (email, phone, user ID)
-   Transaction and signature management
-   Balance queries and ENS resolution

## Installation

```bash
poetry add goat-sdk-wallet-crossmint
```

## Usage

```python
from goat_wallets.crossmint import smart_wallet_factory, custodial_factory
from crossmint.common_sdk_base import CrossmintApiClient

# Initialize Crossmint client
crossmint_client = CrossmintApiClient(...)

# Create Smart Wallet
smart_wallet = await smart_wallet_factory(crossmint_client)({
    # Required: One of the following to locate the wallet
    "address": "0x...",  # Wallet address, or use linkedUser instead:
    # "linkedUser": {
    #     "email": "user@example.com",  # Or use phone/userId
    #     # "phone": "+1234567890",
    #     # "userId": "user-id"
    # },
    "chain": "base",  # or "ethereum", etc.
    "signer": {
        "secretKey": "0x..."  # Private key for signing
    },
    "provider": "https://base-mainnet.g.alchemy.com/v2/your-api-key",
    "options": {
        "ensProvider": "https://base-mainnet.g.alchemy.com/v2/your-api-key"  # Optional: For ENS resolution
    }
})

# Create Custodial Solana Wallet
custodial_wallet = await custodial_factory(crossmint_client)({
    "connection": solana_connection,  # Solana RPC connection
    # One of the following for wallet location:
    "email": "user@example.com",
    # "phone": "+1234567890",
    # "userId": "user-id",
    # "address": "solana-address"
})
```

## License

MIT License
