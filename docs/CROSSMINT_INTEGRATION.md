# Crossmint Smart Wallet Integration

Dark Dexter now supports Crossmint Smart Wallets, enabling advanced wallet operations including:
- Smart wallet creation with keypair or Fireblocks signers
- Jupiter token swaps
- Lulo yield deposits
- Delegated signer management

## Features

### Smart Wallet Types

1. **Keypair Signer** - Non-custodial wallet with local keypair
2. **Fireblocks Custodial** - MPC custodial wallet with enhanced security

### Operations

- 💱 **Token Swaps** - Swap tokens using Jupiter DEX
- 💰 **Yield Deposits** - Deposit USDC to Lulo for yield
- 📝 **Memo Transactions** - Send on-chain messages
- 💳 **Balance Checking** - Multi-token balance queries
- 👥 **Delegated Signers** - Register and manage delegated signing authority

## Setup

### 1. Install GOAT SDK Dependencies

The required GOAT SDK packages are already included in `pyproject.toml`:

```bash
pip install -e .
```

This will install:
- `goat-sdk` - Core GOAT SDK
- `goat-sdk-wallet-crossmint` - Crossmint wallet provider
- `goat-sdk-wallet-solana` - Solana wallet support
- `goat-sdk-adapter-langchain` - LangChain integration
- `goat-sdk-plugin-jupiter` - Jupiter DEX integration
- `goat-sdk-plugin-lulo` - Lulo yield platform integration

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# Crossmint API Configuration
CROSSMINT_API_KEY=your_crossmint_api_key
CROSSMINT_BASE_URL=https://staging.crossmint.com  # or https://www.crossmint.com for production
CROSSMINT_USER_EMAIL=your_email@example.com  # Optional: for linked user wallets

# Solana RPC
SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com  # or mainnet RPC
```

### 3. Obtain Crossmint API Key

1. Visit [Crossmint Console](https://staging.crossmint.com/console) (staging) or [Production Console](https://www.crossmint.com/console)
2. Create a new Smart Wallet project
3. Navigate to API Keys section
4. Create API key with required scopes:
   - `wallets.create` - Create smart wallets
   - `wallets.read` - Read wallet information
   - `wallets:balance.read` - Check wallet balances
   - `wallets:messages.sign` - Sign messages
   - `wallets:nfts.read` - Read NFT information

## Usage

### Basic Example

```python
from src.dexter.tools.crossmint.wallet import CrossmintWalletManager
from src.dexter.tools.crossmint.operations import CrossmintOperations

# Initialize wallet manager
manager = CrossmintWalletManager()

# Create or load wallet
wallet = manager.get_or_create_wallet(
    signer_type="keypair",  # or "fireblocks"
    linked_user=None  # Optional: "email:user@example.com"
)

# Check balance
balances = manager.get_wallet_balance(wallet, tokens=["sol", "usdc"])
print(balances)

# Send memo transaction
operations = CrossmintOperations()
response = operations.send_memo(wallet, "Hello from Dark Dexter!")
```

### Running the Example Script

```bash
python3 examples/crossmint_example.py
```

This will:
1. Create/load a Crossmint Smart Wallet
2. Display wallet address and admin signer
3. Check SOL and USDC balances
4. Send a memo transaction
5. Show examples for token swaps and yield deposits

## Wallet Operations

### Creating a Wallet

#### Keypair Signer (Non-Custodial)

```python
wallet = manager.create_keypair_wallet(
    linked_user="email:user@example.com",  # Optional
    save_config=True
)
```

#### Fireblocks Signer (MPC Custodial)

```python
wallet = manager.create_fireblocks_wallet(
    linked_user="email:user@example.com",  # Required
    save_config=True
)
```

### Loading Existing Wallet

```python
wallet = manager.load_wallet_from_config()
```

Wallet configuration is saved to: `~/.dexter/crossmint_wallet.json`

### Checking Balance

```python
# Check specific tokens
balances = manager.get_wallet_balance(wallet, tokens=["sol", "usdc", "bonk"])

# Parse balance
for balance in balances:
    token = balance["token"]
    total = balance["balances"]["total"]
    print(f"{token.upper()}: {total}")
```

## Advanced Operations

### Token Swaps (Jupiter)

Swap tokens using Jupiter DEX aggregator:

```python
import asyncio

# Example: Swap 1 USDC for MOTHER token
usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
mother_mint = "3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN"

response = await CrossmintOperations.swap_tokens(
    wallet=wallet,
    input_mint=usdc_mint,
    output_mint=mother_mint,
    amount=1_000_000,  # 1 USDC (6 decimals)
    slippage_bps=100  # 1% slippage
)

print(f"Swap hash: {response['hash']}")
```

**Note**: Jupiter swaps require:
- Mainnet connection
- Sufficient USDC balance
- SOL for transaction fees

### Lulo Yield Deposits

Deposit USDC to Lulo for yield:

```python
import asyncio

# Deposit 5 USDC to Lulo
response = await CrossmintOperations.deposit_to_lulo(
    wallet=wallet,
    amount_usdc=5.0
)

print(f"Deposit successful!")
```

**Note**: Lulo deposits require:
- Mainnet connection
- Sufficient USDC balance
- SOL for transaction fees

### Memo Transactions

Send on-chain messages:

```python
response = CrossmintOperations.send_memo(
    wallet=wallet,
    memo="My first crossmint transaction! 🚀"
)

print(f"Transaction hash: {response['hash']}")
```

### Wait for Balance

Helper to wait for sufficient balance:

```python
# Wait for at least 0.001 SOL
balance = CrossmintOperations.wait_for_balance(
    wallet=wallet,
    token="sol",
    minimum_amount=1_000_000  #  0.001 SOL (9 decimals)
)

print(f"Current balance: {balance / 1e9} SOL")
```

## Integration with Dark Dexter

The Crossmint integration is designed to work alongside Dark Dexter's existing features:

### Using with BirdEye

```python
from src.dexter.tools.birdeye.client import BirdEyeClient
from src.dexter.tools.crossmint.wallet import CrossmintWalletManager

# Get trending tokens
birdeye = BirdEyeClient()
trending = birdeye.get_trending_tokens(limit=5)

# Create wallet and check balance
manager = CrossmintWalletManager()
wallet = manager.get_or_create_wallet()

for token in trending:
    print(f"{token.symbol}: ${token.price}")
```

### Using with Helius

```python
from src.dexter.tools.helius.client import HeliusClient
from src.dexter.tools.crossmint.wallet import CrossmintWalletManager

# Get NFTs from Crossmint wallet
helius = HeliusClient()
manager = CrossmintWalletManager()
wallet = manager.get_or_create_wallet()

assets = helius.get_assets_by_owner(wallet.get_address())
print(f"NFTs owned: {len(assets)}")
```

## Wallet Configuration

Wallet configuration is stored in JSON format at `~/.dexter/crossmint_wallet.json`:

```json
{
  "wallet_address": "...",
  "admin_signer": "...",
  "admin_keypair": [...],
  "signer_type": "keypair",
  "linked_user": "email:user@example.com"
}
```

**Security Notes**:
- Keep this file secure - it contains private keys for keypair wallets
- Never commit this file to version control
- For production, consider using Fireblocks custodial signers

## Environment: Staging vs Production

### Staging (Development)

```env
CROSSMINT_BASE_URL=https://staging.crossmint.com
SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

- Use for testing
- Devnet SOL available from faucets
- No real value at risk

### Production (Mainnet)

```env
CROSSMINT_BASE_URL=https://www.crossmint.com
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
```

- Use for real transactions
- Requires real SOL and tokens
- All transactions are permanent

## Troubleshooting

### Import Errors

If you see import errors for GOAT SDK packages:

```bash
pip install -e .
```

### API Key Errors

```
ValueError: CROSSMINT_API_KEY is required
```

Solution: Add `CROSSMINT_API_KEY` to your `.env` file

### Insufficient Balance

```
Error: No SOL balance found
```

Solution:
- For devnet: Use [Solana Faucet](https://faucet.solana.com/)
- For mainnet: Transfer SOL to your wallet

### Transaction Failures

Check:
1. Sufficient SOL for transaction fees (gas)
2. Sufficient token balance for swaps/deposits
3. Correct network (devnet vs mainnet)
4. RPC endpoint is accessible

## Resources

- [Crossmint Documentation](https://docs.crossmint.com/)
- [Crossmint Console](https://www.crossmint.com/console)
- [GOAT SDK Documentation](https://ohmygoat.dev/)
- [Jupiter Documentation](https://station.jup.ag/docs)
- [Lulo Finance](https://lulo.fi/)

## Security Best Practices

1. **API Keys**: Store in `.env`, never in code
2. **Private Keys**: Use Fireblocks for production
3. **Testing**: Always test on devnet first
4. **Permissions**: Use minimal required API scopes
5. **Monitoring**: Track all transactions
6. **Backup**: Keep secure backups of wallet configs

## Next Steps

1. Test wallet creation on devnet
2. Try memo transactions
3. Fund wallet and test swaps on mainnet
4. Explore yield strategies with Lulo
5. Integrate with your AI agent workflows

---

**Need Help?**
- Check the [example script](../examples/crossmint_example.py)
- Review [Dark Dexter docs](./DARK_DEXTER.md)
- Read [GOAT SDK guides](https://github.com/goat-sdk/goat)
