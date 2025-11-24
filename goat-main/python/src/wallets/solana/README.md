# Solana Wallet for GOAT SDK

A Python implementation of a Solana wallet for the GOAT SDK, providing secure key management and transaction signing capabilities.

## Installation

```bash
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_wallets.solana import solana, SPL_TOKENS
from solana.rpc.api import Client as SolanaClient
from solders.keypair import Keypair

# Initialize Solana client
client = SolanaClient("https://api.mainnet-beta.solana.com")

# Initialize wallet with seed phrase and token support
keypair = Keypair.from_base58_string("${SOLANA_WALLET_SEED}")  # Your base58-encoded seed phrase
wallet = solana(
    client, 
    keypair,
    tokens=SPL_TOKENS,  # Enable SPL token functionality
    enable_send=True    # Enable token sending capability
)

# Get wallet address
address = wallet.get_address()

# Get SOL balance
balance = await wallet.get_balance()

# Sign and send transaction
signature = await wallet.sign_and_send_transaction(
    transaction="your_encoded_transaction"
)

# Get transaction status
status = await wallet.get_transaction_status(signature)
```

## Features

- Secure Key Management:
  - Seed phrase support
  - Public/private key pair generation
  - Address derivation
  
- Transaction Operations:
  - Transaction signing
  - Transaction sending
  - Status tracking
  - Signature verification
  
- Balance Management:
  - SOL balance queries
  - Token account balance
  - Associated token accounts
  
- Network Support:
  - Mainnet Beta
  - Testnet
  - Devnet
  - Custom RPC endpoints

## License

This project is licensed under the terms of the MIT license.
