# Crossmint Headless Checkout Plugin for GOAT SDK

A plugin for the GOAT SDK that enables seamless purchasing of Amazon items and other tokenized products using cryptocurrency through Crossmint's headless checkout API.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-crossmint-headless-checkout

# Install optional wallet dependencies for chain-specific operations
poetry add goat-sdk-wallet-evm
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.crossmint_headless_checkout import crossmint_headless_checkout, CrossmintHeadlessCheckoutPluginOptions

# Initialize the plugin
options = CrossmintHeadlessCheckoutPluginOptions(
    api_key="your-crossmint-api-key"
)
plugin = crossmint_headless_checkout(options)

# Example: Purchase an Amazon product
order = await plugin.buy_token(
    recipient={
        "email": "customer@example.com",
        "physicalAddress": {
            "name": "John Doe",
            "line1": "123 Main St",
            "line2": "Apt 4B",
            "city": "New York",
            "state": "NY",
            "postalCode": "10001",
            "country": "US"
        }
    },
    payment={
        "method": "base-sepolia",
        "currency": "usdc",
        "payerAddress": "0x1234567890123456789012345678901234567890",
        "receiptEmail": "customer@example.com"
    },
    lineItems=[{
        "productLocator": "amazon:B08SVZ775L",
        "callData": {"totalPrice": "29.99"}
    }],
    locale="en-US"
)
```

## Features

- **Amazon Product Purchase**: Buy Amazon items using cryptocurrency
- **Multi-chain Support**: Compatible with EVM chains (Ethereum, Base, Polygon) and Solana
- **Payment Methods**: Support for USDC, ETH, SOL, and other cryptocurrencies
- **Global Shipping**: Handle international shipping addresses and billing
- **Order Management**: Track order status and transaction details

### Available Tools

**Plugin Tools:**
- `buy_token`: Purchase tokenized products (Amazon items, NFTs, etc.) using cryptocurrency

**Wallet Core Tools:**
- `get_address`: Get the wallet's public address
- `get_chain`: Get information about the blockchain network
- `get_balance`: Get balance for native currency or specific tokens
- `get_token_info_by_ticker`: Get information about a token by its ticker symbol (e.g., USDC, SOL)
- `convert_to_base_units`: Convert token amounts from human-readable to base units
- `convert_from_base_units`: Convert token amounts from base units to human-readable format

**Additional EVM Tools** (when using EVM wallets):
- `get_token_allowance_evm`: Check ERC20 token allowances for spenders
- `sign_typed_data_evm`: Sign EIP-712 typed data structures
- `send_token`: Send native currency (ETH) or ERC20 tokens (when sending is enabled)
- `approve_token_evm`: Approve ERC20 token spending allowances (when sending is enabled)
- `revoke_token_approval_evm`: Revoke ERC20 token approvals (when sending is enabled)

**Additional Solana Tools** (when using Solana wallets):
- `send_token`: Send native SOL or SPL tokens (when sending is enabled)

### Supported Payment Methods
- **EVM Chains**: USDC, ETH on Ethereum, Base, Polygon
- **Solana**: USDC-SPL, SOL, and other SPL tokens

## License

This project is licensed under the terms of the MIT license.
