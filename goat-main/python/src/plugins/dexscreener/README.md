# DEXScreener Plugin for GOAT SDK

A plugin for the GOAT SDK that provides real-time DEX pair data, price feeds, and liquidity information across multiple blockchain networks through the DEXScreener API.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-dexscreener

# Install optional wallet dependencies for chain-specific operations
poetry add goat-sdk-wallet-evm
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.dexscreener import dexscreener, DexscreenerPluginOptions

# Initialize the plugin
options = DexscreenerPluginOptions()
plugin = dexscreener(options)

# Get pair data by chain and pair address
eth_pair = await plugin.get_pair(
    chain_id="ethereum",
    pair_address="0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"  # USDC-ETH
)

# Search for pairs by token address
pairs = await plugin.search_pairs(
    token_address="0x6B175474E89094C44Da98b954EedeAC495271d0F"  # DAI
)

# Get Solana token pairs
sol_pairs = await plugin.get_pairs(
    chain_id="solana",
    token_address="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
)
```

## Features

- DEX Pair Data:
  - Price and volume metrics
  - Liquidity information
  - Trading volume analytics
  - Price change statistics
  
- Search Capabilities:
  - Token address search
  - Pair address lookup
  - Multi-chain queries
  - Real-time updates
  
- Market Analysis:
  - Price trends
  - Volume analysis
  - Liquidity depth
  - Trading patterns
  
- Supported Networks:
  - Ethereum
  - BSC
  - Polygon
  - Arbitrum
  - Optimism
  - Avalanche
  - Solana
  - Base
  - All major DEX-enabled chains

## License

This project is licensed under the terms of the MIT license.
