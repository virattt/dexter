# CoinGecko Plugin for GOAT SDK

A plugin for the GOAT SDK that provides comprehensive cryptocurrency market data, price feeds, and analytics through the CoinGecko API.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-coingecko

# Install optional wallet dependencies for chain-specific operations
poetry add goat-sdk-wallet-evm
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.coingecko import coingecko, CoinGeckoPluginOptions

# Initialize the plugin
options = CoinGeckoPluginOptions(
    api_key="${COINGECKO_API_KEY}"  # Your CoinGecko API key
)
plugin = coingecko(options)

# Get token price data
prices = await plugin.get_token_prices(
    token_ids=["bitcoin", "ethereum"],
    vs_currencies=["usd", "eur"]
)

# Get detailed market data
market_data = await plugin.get_market_data(
    token_id="ethereum",
    include_community_data=True,
    include_developer_data=True
)

# Get historical price data
history = await plugin.get_price_history(
    token_id="bitcoin",
    vs_currency="usd",
    days=30,
    interval="daily"
)
```

## Features

- Market Data:
  - Real-time price feeds
  - Historical price data
  - Volume statistics
  - Market capitalization
  
- Token Analytics:
  - Price change metrics
  - Trading volume analysis
  - Market dominance
  - Supply information
  
- Additional Data:
  - Community metrics
  - Developer activity
  - Social statistics
  - Exchange listings
  
- Supported Features:
  - Multi-currency support
  - Custom time intervals
  - Batch data retrieval
  - Rate limit handling
  
- Market Categories:
  - Cryptocurrencies
  - DeFi tokens
  - NFT projects
  - Exchange tokens
  - Layer 1/2 tokens

## License

This project is licensed under the terms of the MIT license.
