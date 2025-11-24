# Dark Dexter User Guide 🌑

Complete reference for Dark Dexter - the Solana-native AI agent with autonomous wallet, DeFi trading, and 200+ blockchain tools.

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Architecture Overview](#architecture-overview)
4. [Core Components](#core-components)
5. [Features Guide](#features-guide)
6. [API References](#api-references)
7. [Advanced Usage](#advanced-usage)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

Dark Dexter is an evolution of the Dexter financial research agent, extended with comprehensive Solana blockchain capabilities. It combines:

- **Traditional Financial Research**: Stock analysis, financial statements, market data
- **Blockchain Data**: Real-time Solana on-chain analytics via Helius DAS API
- **Token Intelligence**: Live token prices, trending tokens, and portfolio tracking via BirdEye
- **Autonomous Wallet**: Self-managed Crossmint smart wallets with MPC custody
- **DeFi Operations**: 200+ tools via GOAT SDK for trading, yield farming, and analytics
- **AI-Powered Trading**: LangChain integration for autonomous decision-making

### What Makes Dark Dexter Special?

- **Fully Autonomous**: Creates its own wallet, manages balances, executes trades
- **Multi-Source Intelligence**: Aggregates data from Helius, BirdEye, Jupiter, and more
- **Security-First**: Built-in rug pull detection and token security scoring
- **Extensible**: Easy plugin system for adding new DeFi protocols

---

## Quick Start

### Prerequisites

```bash
# Required
- Python 3.10+
- uv package manager

# API Keys needed:
- Helius API key (https://www.helius.dev/)
- BirdEye API key (https://birdeye.so/)
- Crossmint API key (https://www.crossmint.com/)
- OpenAI API key (https://platform.openai.com/api-keys)
- Optional: CoinGecko API key for enhanced data
```

### Installation

```bash
# Clone repository
git clone https://github.com/virattt/dexter.git
cd dexter

# Install dependencies
uv sync

# Configure environment
cp env.example .env
# Edit .env with your API keys
```

### Environment Configuration

```bash
# Core Dexter
OPENAI_API_KEY=your-openai-key
FINANCIAL_DATASETS_API_KEY=your-fd-key

# Blockchain APIs
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=your-helius-key
BIRDEYE_API_KEY=your-birdeye-key

# Wallet & DeFi
CROSSMINT_API_KEY=your-crossmint-key
COINGECKO_API_KEY=your-coingecko-key  # Optional

# Wallet Type (fireblocks or keypair)
WALLET_TYPE=fireblocks
FIREBLOCKS_API_KEY=your-fireblocks-key  # If using Fireblocks
```

### First Run

```bash
# Launch Dark Dexter
python dark_dexter.py
```

On first run, Dark Dexter will:
1. Display ASCII art banner
2. Automatically create a Crossmint smart wallet
3. Fetch trending Solana tokens from BirdEye
4. Check wallet balances across multiple sources
5. Initialize all GOAT SDK plugins

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Dark Dexter Core                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Dexter    │  │  Crossmint  │  │    GOAT     │    │
│  │   Agent     │  │   Wallet    │  │     SDK     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
           │                 │                │
           ▼                 ▼                ▼
┌──────────────────────────────────────────────────────────┐
│                    Data Layer                             │
├──────────────┬──────────────┬──────────────┬─────────────┤
│   Helius     │   BirdEye    │   Jupiter    │   Lulo      │
│   DAS API    │   API        │   DEX        │   Finance   │
└──────────────┴──────────────┴──────────────┴─────────────┘
```

### Data Flow

1. **User Request** → Dark Dexter analyzes intent
2. **Planning** → Breaks down into actionable tasks
3. **Data Gathering** → Fetches from multiple sources
4. **Wallet Operations** → Executes on-chain transactions
5. **Validation** → Verifies results and safety
6. **Response** → Presents findings to user

---

## Core Components

### 1. Helius Integration

**Purpose**: Access to Solana blockchain data via Digital Asset Standard (DAS) API

**Capabilities**:
- Get NFT and compressed NFT metadata
- Search assets by owner, creator, or attributes
- Fetch asset proof for compression verification
- Batch operations for multiple assets
- Get assets by authority or group

**Key Methods**:
```python
from src.dexter.tools.helius.client import HeliusClient

client = HeliusClient()

# Get single asset
asset = client.get_asset("asset_id")

# Batch retrieve
assets = client.get_asset_batch(["id1", "id2", "id3"])

# Search by owner
assets = client.search_assets(owner_address="wallet_address")

# Get asset proof
proof = client.get_asset_proof("asset_id")

# Search by creator
assets = client.get_assets_by_creator("creator_address")

# Search by group
assets = client.get_assets_by_group("group_key", "group_value")
```

**Use Cases**:
- NFT portfolio analysis
- Compressed NFT verification
- Asset ownership tracking
- Collection analytics

**Documentation**: See [HELIUS_INTEGRATION.md](HELIUS_INTEGRATION.md)

### 2. BirdEye Integration

**Purpose**: Real-time Solana token data and analytics

**Capabilities**:
- Trending tokens on Solana
- Token price data (real-time and historical)
- Wallet portfolio tracking
- Token metadata and market stats

**Key Methods**:
```python
from src.dexter.tools.birdeye.client import BirdEyeClient

client = BirdEyeClient()

# Get trending tokens
trending = client.get_trending_tokens(
    sort_by="volume24h",
    sort_type="desc",
    limit=10
)

# Get token price
price = client.get_token_price("token_address")

# Get wallet portfolio
portfolio = client.get_wallet_portfolio("wallet_address")
```

**Use Cases**:
- Market trend analysis
- Portfolio valuation
- Token discovery
- Price tracking

### 3. Crossmint Wallet Manager

**Purpose**: Autonomous smart wallet creation and management

**Capabilities**:
- Create Crossmint smart wallets
- Two signer types: Fireblocks (MPC) or Keypair
- Balance checking across tokens
- Transaction signing and sending
- Memo transaction support

**Key Methods**:
```python
from src.dexter.tools.crossmint.wallet import CrossmintWalletManager

manager = CrossmintWalletManager()

# Create wallet (automatically uses WALLET_TYPE from env)
wallet_address = manager.create_wallet()

# Get SOL balance
balance = manager.get_balance(wallet_address)

# Get all token balances
balances = manager.get_all_balances(wallet_address)

# Send transaction with memo
from src.dexter.tools.crossmint.operations import CrossmintOperations
ops = CrossmintOperations()
signature = ops.send_memo_transaction(
    wallet_address,
    "Hello from Dark Dexter!"
)
```

**Use Cases**:
- Autonomous wallet creation
- Secure custody with MPC
- Multi-token balance tracking
- Transaction execution

**Documentation**: See [CROSSMINT_INTEGRATION.md](CROSSMINT_INTEGRATION.md)

### 4. GOAT SDK Plugins

**Purpose**: 200+ DeFi tools and protocol integrations

**Available Plugins**:

#### Jupiter DEX Plugin
- Token swaps on Solana's largest DEX aggregator
- Route optimization for best prices
- Slippage protection
- Multi-hop swaps

```python
from src.dexter.tools.goat_plugins.manager import GOATPluginManager

manager = GOATPluginManager()
jupiter = manager.get_jupiter_plugin()

# Get swap quote
quote = jupiter.get_quote(
    input_mint="SOL_ADDRESS",
    output_mint="USDC_ADDRESS",
    amount=1000000000  # 1 SOL in lamports
)

# Execute swap
signature = jupiter.swap(quote)
```

#### Lulo Finance Plugin
- USDC yield farming
- Deposit and withdraw operations
- Real-time APY tracking
- Auto-compounding

```python
lulo = manager.get_lulo_plugin()

# Get current APY
apy = lulo.get_apy()

# Deposit USDC
signature = lulo.deposit(amount_usdc=100)

# Withdraw
signature = lulo.withdraw(amount_usdc=50)
```

#### CoinGecko Plugin
- Token price data across chains
- Historical price charts
- Market cap and volume
- Token metadata

```python
from src.dexter.tools.goat_plugins.coingecko_wrapper import CoinGeckoWrapper

coingecko = CoinGeckoWrapper()

# Get token price
price = coingecko.get_token_price("solana")

# Get market data
data = coingecko.get_token_market_data("ethereum", days=30)
```

#### DexScreener Plugin
- Multi-DEX price aggregation
- Liquidity pool analytics
- Trading volume tracking
- Price charts

```python
from src.dexter.tools.goat_plugins.dexscreener_wrapper import DexScreenerWrapper

dex = DexScreenerWrapper()

# Get token pairs
pairs = dex.get_token_pairs("token_address")

# Get DEX analytics
analytics = dex.get_dex_analytics("solana")
```

#### RugCheck Plugin
- Token security scoring
- Rug pull detection
- Liquidity lock verification
- Mint authority analysis

```python
from src.dexter.tools.goat_plugins.rugcheck_wrapper import RugCheckWrapper

rugcheck = RugCheckWrapper()

# Check token safety
report = rugcheck.check_token("token_address")
# Returns: risk_score, warnings, liquidity_locked, etc.
```

#### Nansen Plugin
- Wallet intelligence
- Smart money tracking
- Token holder analysis
- Transaction patterns

```python
from src.dexter.tools.goat_plugins.nansen_wrapper import NansenWrapper

nansen = NansenWrapper()

# Analyze wallet
analysis = nansen.analyze_wallet("wallet_address")

# Get token holders
holders = nansen.get_token_holders("token_address")
```

**Documentation**: See [CROSSMINT_INTEGRATION.md](CROSSMINT_INTEGRATION.md#goat-sdk-integration)

---

## Features Guide

### Autonomous Wallet Creation

Dark Dexter automatically creates and manages its own Solana wallet using Crossmint:

```python
# Automatic on first run
python dark_dexter.py

# Manual creation
from src.dexter.tools.crossmint.wallet import CrossmintWalletManager

manager = CrossmintWalletManager()
wallet_address = manager.create_wallet()
print(f"Created wallet: {wallet_address}")
```

**Wallet Types**:

1. **Fireblocks Signer** (Recommended for production)
   - MPC (Multi-Party Computation) custody
   - Enterprise-grade security
   - Requires Fireblocks API key

2. **Keypair Signer** (For development/testing)
   - Direct keypair management
   - Simpler setup
   - Lower security for production

### Multi-Source Balance Checking

Dark Dexter validates balances across multiple sources for accuracy:

```python
from src.dexter.tools.helius.client import HeliusClient
from src.dexter.tools.birdeye.client import BirdEyeClient
from src.dexter.tools.crossmint.wallet import CrossmintWalletManager

wallet = "your_wallet_address"

# Helius (via DAS API)
helius = HeliusClient()
helius_assets = helius.search_assets(owner_address=wallet)

# BirdEye
birdeye = BirdEyeClient()
birdeye_portfolio = birdeye.get_wallet_portfolio(wallet)

# Crossmint
crossmint = CrossmintWalletManager()
crossmint_balances = crossmint.get_all_balances(wallet)

# Jupiter (via GOAT SDK)
from src.dexter.tools.goat_plugins.manager import GOATPluginManager
manager = GOATPluginManager()
jupiter = manager.get_jupiter_plugin()
jupiter_balances = jupiter.get_wallet_balances(wallet)
```

### Token Discovery & Trending

Find hot tokens and analyze trends:

```python
from src.dexter.tools.birdeye.client import BirdEyeClient

client = BirdEyeClient()

# Top trending by volume
trending = client.get_trending_tokens(
    sort_by="volume24h",
    sort_type="desc",
    limit=20
)

for token in trending:
    print(f"{token['symbol']}: ${token['price']} "
          f"({token['priceChange24h']}%)")
```

### Security Analysis

Check token safety before trading:

```python
from src.dexter.tools.goat_plugins.rugcheck_wrapper import RugCheckWrapper

rugcheck = RugCheckWrapper()

# Analyze token
report = rugcheck.check_token("token_mint_address")

if report['risk_score'] > 7:
    print("⚠️ High risk token!")
    print(f"Warnings: {report['warnings']}")
else:
    print(f"✅ Risk score: {report['risk_score']}/10")
    print(f"Liquidity locked: {report['liquidity_locked']}")
```

### AI-Powered Trading

Use LangChain for autonomous decisions:

```python
from langchain_openai import ChatOpenAI
from src.dexter.tools.goat_plugins.manager import GOATPluginManager

# Initialize AI agent
llm = ChatOpenAI(model="gpt-4")
manager = GOATPluginManager()

# Add tools to agent
tools = manager.get_all_tools()

# Create agent with tools
from langchain.agents import create_tool_calling_agent
agent = create_tool_calling_agent(llm, tools)

# AI can now use all GOAT plugins autonomously
response = agent.invoke({
    "input": "Check if SOL is safe to buy, then swap 1 SOL to USDC"
})
```

---

## API References

### Helius Client

```python
class HeliusClient:
    def __init__(self, api_key: str = None, rpc_url: str = None)
    
    def get_asset(self, id: str) -> dict
    def get_asset_batch(self, ids: List[str]) -> dict
    def get_asset_proof(self, id: str) -> dict
    def search_assets(self, owner_address: str = None, **kwargs) -> dict
    def get_assets_by_creator(self, creator_address: str, **kwargs) -> dict
    def get_assets_by_group(self, group_key: str, group_value: str, **kwargs) -> dict
```

### BirdEye Client

```python
class BirdEyeClient:
    def __init__(self, api_key: str = None)
    
    def get_trending_tokens(
        self,
        sort_by: str = "volume24h",
        sort_type: str = "desc",
        offset: int = 0,
        limit: int = 20
    ) -> List[dict]
    
    def get_token_price(self, address: str) -> dict
    def get_wallet_portfolio(self, wallet: str) -> dict
```

### Crossmint Wallet Manager

```python
class CrossmintWalletManager:
    def __init__(self, api_key: str = None, wallet_type: str = None)
    
    def create_wallet(self) -> str
    def get_balance(self, wallet_address: str) -> int
    def get_all_balances(self, wallet_address: str) -> List[dict]
```

### GOAT Plugin Manager

```python
class GOATPluginManager:
    def __init__(self)
    
    def initialize_all_plugins(self) -> None
    def get_jupiter_plugin(self) -> JupiterPlugin
    def get_lulo_plugin(self) -> LuloPlugin
    def get_all_tools(self) -> List[Tool]
```

---

## Advanced Usage

### Custom Plugin Development

Create your own GOAT SDK plugin wrapper:

```python
# src/dexter/tools/goat_plugins/custom_wrapper.py
from goat_sdk import Plugin

class CustomProtocolWrapper:
    def __init__(self):
        self.plugin = Plugin("custom-protocol")
    
    def custom_operation(self, params):
        return self.plugin.execute("operation", params)

# Register in manager
from src.dexter.tools.goat_plugins.manager import GOATPluginManager

manager = GOATPluginManager()
manager.register_plugin("custom", CustomProtocolWrapper())
```

### Webhook Integration

Set up webhooks for real-time events:

```python
from src.dexter.tools.helius.client import HeliusClient

client = HeliusClient()

# Monitor wallet for transactions
def on_transaction(tx):
    print(f"New transaction: {tx['signature']}")
    
# Set up webhook (implementation depends on your setup)
# Helius supports webhooks for real-time events
```

### Batch Operations

Process multiple operations efficiently:

```python
from src.dexter.tools.helius.client import HeliusClient

client = HeliusClient()

# Batch get assets
asset_ids = ["id1", "id2", "id3", "id4", "id5"]
assets = client.get_asset_batch(asset_ids)

# Process in parallel
import asyncio

async def process_asset(asset_id):
    asset = client.get_asset(asset_id)
    # Process asset data
    return asset

async def main():
    tasks = [process_asset(id) for id in asset_ids]
    results = await asyncio.gather(*tasks)
    return results
```

### Error Handling

Robust error handling patterns:

```python
from src.dexter.tools.birdeye.client import BirdEyeClient
import logging

logger = logging.getLogger(__name__)

def safe_get_trending():
    try:
        client = BirdEyeClient()
        return client.get_trending_tokens(limit=10)
    except Exception as e:
        logger.error(f"Failed to get trending tokens: {e}")
        return []

# With retry logic
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
def resilient_operation():
    client = BirdEyeClient()
    return client.get_trending_tokens()
```

---

## Troubleshooting

### Common Issues

#### 1. Wallet Creation Fails

**Problem**: Crossmint wallet creation returns error

**Solutions**:
- Verify `CROSSMINT_API_KEY` is set correctly
- Check `WALLET_TYPE` is either "fireblocks" or "keypair"
- If using Fireblocks, ensure `FIREBLOCKS_API_KEY` is set
- Check API key permissions in Crossmint dashboard

#### 2. Helius API Rate Limits

**Problem**: Getting rate limit errors from Helius

**Solutions**:
- Implement exponential backoff
- Use batch operations when possible
- Cache responses for repeated queries
- Upgrade Helius plan for higher limits

```python
import time

def rate_limited_call(func, *args, **kwargs):
    max_retries = 3
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except RateLimitError:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                raise
```

#### 3. BirdEye Data Not Loading

**Problem**: BirdEye API returns empty or null data

**Solutions**:
- Verify `BIRDEYE_API_KEY` is valid
- Check token address is correct
- Ensure chain is "solana" not "ethereum"
- Some tokens may not have data on BirdEye

#### 4. GOAT SDK Plugin Errors

**Problem**: Plugin initialization fails

**Solutions**:
- Run `uv sync` to ensure all GOAT packages are installed
- Check individual plugin requirements
- Verify network connectivity to Solana RPC
- Review plugin-specific API key requirements

#### 5. Transaction Failures

**Problem**: Transactions fail to execute

**Solutions**:
- Ensure wallet has sufficient SOL for gas
- Check slippage settings for swaps
- Verify recipient addresses are valid
- Monitor Solana network status

### Debug Mode

Enable verbose logging:

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Now all API calls will be logged
```

### Support Resources

- **GitHub Issues**: Report bugs at https://github.com/virattt/dexter/issues
- **Documentation**: Read detailed guides in `/docs` folder
- **Examples**: Check `/examples` for working code samples
- **Helius Docs**: https://docs.helius.dev/
- **BirdEye Docs**: https://docs.birdeye.so/
- **Crossmint Docs**: https://docs.crossmint.com/
- **GOAT SDK**: https://github.com/goat-sdk/

---

## Best Practices

### Security

1. **Never commit API keys** - Use `.env` file and add to `.gitignore`
2. **Use Fireblocks for production** - MPC custody is more secure
3. **Validate before trading** - Always check token safety with RugCheck
4. **Start small** - Test with small amounts before large trades
5. **Monitor transactions** - Keep track of all on-chain operations

### Performance

1. **Batch operations** - Use batch methods when available
2. **Cache data** - Store frequently accessed data
3. **Use async** - Parallelize independent operations
4. **Rate limiting** - Respect API limits
5. **Connection pooling** - Reuse HTTP connections

### Development

1. **Test on devnet first** - Use Solana devnet before mainnet
2. **Log everything** - Comprehensive logging helps debugging
3. **Error handling** - Graceful degradation for API failures
4. **Version control** - Track all changes to wallet operations
5. **Documentation** - Comment complex operations

---

## Conclusion

Dark Dexter provides a comprehensive platform for Solana DeFi operations with AI-powered decision making. The combination of multiple data sources, autonomous wallet management, and extensive tool integration makes it a powerful foundation for building advanced trading bots and financial agents.

For detailed technical documentation on specific components:
- [Helius Integration Guide](HELIUS_INTEGRATION.md)
- [Dark Dexter Overview](DARK_DEXTER.md)
- [Crossmint & GOAT SDK Guide](CROSSMINT_INTEGRATION.md)

Happy building! 🌑🚀
