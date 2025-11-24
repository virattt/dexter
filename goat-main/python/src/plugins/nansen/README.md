# Nansen Plugin for GOAT SDK

A plugin for the GOAT SDK that provides access to Nansen's on-chain analytics and data services across multiple blockchains.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-nansen

# Install required wallet dependencies
poetry add goat-sdk-wallet-evm
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.nansen import nansen, NansenPluginOptions

# Initialize the plugin
options = NansenPluginOptions(
    api_key="${COINMARKETCAP_API}"  # Your Nansen API key
)
plugin = nansen(options)

# Get token analytics
token_data = await plugin.get_token_analytics(
    token_address="0x6B175474E89094C44Da98b954EedeAC495271d0F",  # DAI
    chain="ethereum"
)

# Get NFT collection analytics
nft_data = await plugin.get_nft_collection_analytics(
    collection_address="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",  # BAYC
    chain="ethereum",
    time_range="24h"
)

# Get smart money flows
smart_money = await plugin.get_smart_money_flows(
    token_address="0x6B175474E89094C44Da98b954EedeAC495271d0F",  # DAI
    chain="ethereum",
    wallet_labels=["smart_money", "institutions"]
)
```

## Features

- Token Analytics:
  - Historical price and volume data
  - Token holder analysis
  - Smart money flow tracking
  - Trading activity metrics
  
- NFT Analytics:
  - Collection statistics
  - Floor price tracking
  - Holder distribution
  - Trading volume analysis
  
- Smart Money Tracking:
  - Wallet labeling and categorization
  - Token flow analysis
  - Smart money movement alerts
  - Institution tracking
  
- Supported Chains:
  - Ethereum
  - Polygon
  - BNB Chain
  - Arbitrum
  - Optimism
  - Avalanche
  - Solana
  - Base

## License

This project is licensed under the terms of the MIT license.
