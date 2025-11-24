# Crossmint Wallet Examples

This directory contains comprehensive examples demonstrating the usage of Crossmint's wallet API functionality.

## Setup

1. Install dependencies:
```bash
poetry install
```

2. Create a `.env` file with required environment variables:
```bash
cp .env.template .env
```

Required environment variables:
- `CROSSMINT_API_KEY`: Your Crossmint API key
- `CROSSMINT_USER_EMAIL`: Email for wallet creation
- `CROSSMINT_DELEGATED_EMAIL`: Email for delegated signer examples
- `CROSSMINT_BASE_URL`: Crossmint API base URL (defaults to staging)
- `SOLANA_RPC_ENDPOINT`: Solana RPC endpoint (defaults to Devnet)

## Available Examples

### 1. Advanced Operations
```bash
poetry run python examples/advanced_operations.py
```
Demonstrates:
- Multi-signer transactions
- Time-bound delegated signers
- Complex transaction approval flows

### 2. Wallet Management
```bash
poetry run python examples/wallet_management.py
```
Demonstrates:
- Creating EVM and Solana Smart Wallets
- Retrieving wallet information
- Checking wallet balances
- Funding wallets

### 2. Transaction Operations
```bash
poetry run python examples/transaction_operations.py
```
Demonstrates:
- Creating EVM and Solana transactions
- Monitoring transaction status
- Approving transactions
- Retrieving transaction history

### 3. Signature Operations
```bash
poetry run python examples/signature_operations.py
```
Demonstrates:
- Creating signature requests
- Monitoring signature status
- Approving signatures
- Retrieving signature history

### 4. Delegated Signer Management
```bash
poetry run python examples/delegated_signer.py
```
Demonstrates:
- Registering delegated signers
- Setting signer permissions
- Retrieving signer information

### 5. NFT Operations
```bash
poetry run python examples/nft_operations.py
```
Demonstrates:
- Retrieving NFTs from wallets
