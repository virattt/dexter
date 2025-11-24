# RugCheck Plugin for GOAT SDK

A plugin for the GOAT SDK that provides token security analysis and verification services through the RugCheck API.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-rugcheck

# Install required wallet dependencies
poetry add goat-sdk-wallet-evm
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.rugcheck import rugcheck, RugCheckPluginOptions

# Initialize the plugin
options = RugCheckPluginOptions(
    jwt_token="${ETHERSCAN_API}",  # Optional: JWT token for authenticated access
    base_url="https://api.rugcheck.xyz"  # Optional: Custom API base URL
)
plugin = rugcheck(options)

# Check EVM token security
evm_report = await plugin.analyze_token(
    chain_id=1,  # Ethereum mainnet
    token_address="0x6B175474E89094C44Da98b954EedeAC495271d0F",  # DAI
)

# Check Solana token security
sol_report = await plugin.analyze_token(
    chain="solana",
    token_address="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
)

# Get trending tokens with security scores
trending = await plugin.get_trending_tokens(
    chain="all",
    time_range="24h",
    limit=10
)
```

## Features

- Token Security Analysis:
  - Smart contract audit
  - Liquidity analysis
  - Ownership verification
  - Trading pattern analysis
  
- Risk Assessment:
  - Rugpull risk scoring
  - Honeypot detection
  - Scam token identification
  - Malicious contract detection
  
- Market Intelligence:
  - Trending tokens tracking
  - Community voting system
  - Recently verified tokens
  - Historical security incidents
  
- Multi-Chain Support:
  - Ethereum
  - BSC
  - Polygon
  - Arbitrum
  - Optimism
  - Avalanche
  - Solana
  - Base
  
- Additional Features:
  - Rate limit handling
  - JWT authentication
  - Batch analysis support
  - Real-time monitoring

## License

This project is licensed under the terms of the MIT license.
