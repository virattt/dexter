# Jupiter Plugin for GOAT SDK

A plugin for the GOAT SDK that provides Jupiter DEX aggregator functionality for token swaps on Solana.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-jupiter

# Install required wallet dependency
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.jupiter import jupiter, JupiterPluginOptions

# Initialize the plugin
options = JupiterPluginOptions(
    rpc_url="${RPC_PROVIDER_URL}"  # Your Solana RPC URL
)
plugin = jupiter(options)

# Get swap quote
quote = await plugin.get_swap_quote(
    input_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    output_mint="So11111111111111111111111111111111111111112",  # SOL
    amount=1000000,  # 1 USDC (6 decimals)
    slippage_bps=50  # 0.5% slippage tolerance
)

# Execute swap
result = await plugin.swap(
    input_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    output_mint="So11111111111111111111111111111111111111112",  # SOL
    amount=1000000,  # 1 USDC (6 decimals)
    slippage_bps=50,  # 0.5% slippage tolerance
    wallet_address="your_wallet_address"
)
```

## Features

- Token price discovery
- Swap quote generation
- Token swap execution
- Best route finding
- Supported tokens:
  - All SPL tokens
  - Native SOL
  - Wrapped SOL (WSOL)
- Features:
  - Multi-route swaps
  - Split trades
  - Price impact protection
  - MEV protection

## License

This project is licensed under the terms of the MIT license.
