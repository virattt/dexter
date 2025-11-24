# Dark Dexter - Autonomous Financial Intelligence Agent

Dark Dexter is an AI-powered Solana agent with its own wallet, market intelligence, and transaction capabilities.

## Features

- **Autonomous Wallet**: Automatically creates and manages its own Solana wallet
- **Market Intelligence**: Displays trending Solana tokens using BirdEye API
- **Multi-Source Balance Checking**: Checks wallet balance using both BirdEye and Helius APIs
- **Beautiful ASCII Interface**: Branded startup experience
- **Quick Actions**: Easy access to common operations

## Setup

### 1. Install Dependencies

```bash
pip install -e .
```

### 2. Configure API Keys

Create a `.env` file in the project root with the following keys:

```env
# Required for trending tokens and wallet portfolio
BIRDEYE_API_KEY=your_birdeye_api_key

# Required for NFT/asset data and enhanced balance checking
HELIUS_API_KEY=your_helius_api_key
HELIUS_RPC_URL=your_helius_rpc_url
```

### 3. Run Dark Dexter

```bash
python3 dark_dexter.py
```

## Wallet Management

Dark Dexter automatically creates and manages its own Solana wallet:

- **Wallet Location**: `~/.dexter/wallet.json`
- **Auto-Creation**: If no wallet exists, one is created automatically on first run
- **Persistence**: The same wallet is loaded on subsequent runs
- **Security**: Keep the wallet.json file secure - it contains the private key

### Wallet Format

```json
{
  "public_key": "Solana public key",
  "secret_key": [array of bytes]
}
```

## API Integrations

### BirdEye API

Used for:
- Trending Solana tokens
- Token prices and market data
- Wallet portfolio valuation
- Token balances

**Methods Available:**
- `get_trending_tokens()` - Get top trending tokens
- `get_token_price()` - Get current token price
- `get_wallet_portfolio()` - Get wallet's total portfolio value
- `get_wallet_balance()` - Get detailed token balances

### Helius API

Used for:
- NFT and compressed NFT data
- Asset ownership information
- SOL balance checking
- Advanced Solana queries

**Methods Available:**
- `get_asset()` - Get specific NFT/asset data
- `get_assets_by_owner()` - List all assets owned by wallet
- `get_asset_proof()` - Get merkle proof for compressed NFTs
- `get_priority_fee_estimate()` - Calculate transaction fees

## Usage

### Display Format

When you run Dark Dexter, you'll see:

1. **ASCII Art Header** - "DARK DEXTER" branding
2. **Wallet Status** - Address and creation/load confirmation
3. **Trending Tokens** - Top 10 trending Solana tokens with prices and 24h changes
4. **Wallet Balance** - Portfolio value from multiple data sources
5. **Quick Actions** - Menu of available operations

### Example Output

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ██████╗  █████╗ ██████╗ ██╗  ██╗    ██████╗ ███████╗██╗  ██╗████████╗ ║
║   ██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝    ██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝ ║
║   ██║  ██║███████║██████╔╝█████╔╝     ██║  ██║█████╗   ╚███╔╝    ██║    ║
║   ██║  ██║██╔══██║██╔══██╗██╔═██╗     ██║  ██║██╔══╝   ██╔██╗    ██║    ║
║   ██████╔╝██║  ██║██║  ██║██║  ██╗    ██████╔╝███████╗██╔╝ ██╗   ██║    ║
║   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝    ║
║                                                                           ║
║                🌑 Autonomous Financial Intelligence Agent 🌑              ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

🚀 Initializing Dark Dexter Agent...

🔑 Creating new Dark Dexter wallet...
✅ New wallet created: Dd2ETb6eRWJ2WNNJaAHCdEKf1Wr5ZuAUiFSMSDJe7x78
📁 Wallet saved to: /Users/8bit/.dexter/wallet.json

📈 TRENDING SOLANA TOKENS
================================================================================
Rank   Symbol       Name                      Price           24h       
--------------------------------------------------------------------------------
#1     SOL          Solana                    $142.50000000   🟢 +2.45%
#2     BONK         Bonk                      $0.00002340     🔴 -1.23%
...
```

## Code Examples

### Using BirdEye Client

```python
from src.dexter.tools.birdeye.client import BirdEyeClient

# Initialize client
birdeye = BirdEyeClient()

# Get trending tokens
trending = birdeye.get_trending_tokens(limit=10)
for token in trending:
    print(f"{token.symbol}: ${token.price}")

# Get token price
price = birdeye.get_token_price("So11111111111111111111111111111111111111112")
print(f"SOL Price: ${price.value}")

# Get wallet balance
balances = birdeye.get_wallet_balance("your_wallet_address")
for balance in balances:
    print(f"{balance.symbol}: {balance.ui_amount}")
```

### Using Helius Client

```python
from src.dexter.tools.helius.client import HeliusClient

# Initialize client
helius = HeliusClient()

# Get assets owned by wallet
assets = helius.get_assets_by_owner("your_wallet_address", limit=10)
for asset in assets:
    print(f"Asset: {asset.content.metadata.get('name', 'Unknown')}")

# Get specific asset
asset = helius.get_asset("asset_id")
print(f"Owner: {asset.ownership.owner}")

# Get priority fee estimate
fee = helius.get_priority_fee_estimate()
print(f"Recommended fee: {fee.recommended} micro-lamports")
```

## Integration with Dexter Agent

Dark Dexter can be used alongside the main Dexter agent:

```bash
# Run Dark Dexter for market overview and wallet status
python3 dark_dexter.py

# Run main Dexter agent for interactive financial analysis
dexter-agent
```

## Future Enhancements

Planned features:
- ✅ Wallet creation and management
- ✅ Trending tokens display
- ✅ Multi-source balance checking
- ⏳ Jupiter token swaps
- ⏳ NFT minting
- ⏳ Token transfers
- ⏳ GOAT SDK integration for advanced operations
- ⏳ Interactive mode with action selection

## Troubleshooting

### API Key Errors

If you see errors like:
```
⚠️  Error fetching trending tokens: BirdEye API key is required
```

Make sure you have set up your `.env` file with the required API keys.

### Wallet Not Found

The wallet file is stored at `~/.dexter/wallet.json`. If deleted, a new wallet will be automatically created on the next run.

### Import Errors

If you encounter import errors, make sure you've installed the package in editable mode:
```bash
pip install -e .
```

## Security Notes

- Never share your `wallet.json` file - it contains your private key
- Store your `.env` file securely and never commit it to git
- Consider using environment variables in production
- The wallet starts with 0 SOL - you need to fund it before making transactions

## Support

For issues or questions:
- Check the main Dexter documentation
- Review the Helius API documentation: https://docs.helius.dev/
- Review the BirdEye API documentation: https://docs.birdeye.so/

## License

Same as the main Dexter project.
