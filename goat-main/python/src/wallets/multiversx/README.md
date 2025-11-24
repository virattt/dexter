# MultiversX Wallet for GOAT SDK

A Python implementation of a MultiversX wallet for the GOAT SDK, providing secure key management and transaction signing capabilities.

## Installation

```bash
poetry add goat-sdk-wallet-multiversx
```

## Usage

```python
from goat_wallets.multiversx import multiversx_wallet

# Initialize wallet with seed phrase
wallet = multiversx_wallet(
    seed="${MULTIVERSX_WALLET_SEED}",  # Your MultiversX seed phrase
    network="${MULTIVERSX_NETWORK}", # The MultiversX network - "mainnet", "testnet" or "devnet"
)

# Get wallet address
address = wallet.get_address()

# Get EGLD balance
balance = await wallet.get_balance(
    address="the specified wallet address"
)

# Sign message
signature = await wallet.sign_message(
    message="your_message"
)

# Sign and send transaction
transaction_hash = await wallet.send_transaction(
    native_amount="the amount of EGLD to send with the transaction"
    receiver="the receiver of the transaction"
)

# Get transaction status
status = await wallet.get_transaction_status(
    tx_hash="the transaction hash"
)
```

## Use the Embedded SendEGLD Plugin

You can integrate the embedded `SendEGLD` plugin to your agent to enable EGLD transfers like so:

```python
from goat_wallets.multiversx import send_egld

# Initialize tools with MultiversX wallet
tools = get_on_chain_tools(
    wallet=wallet,
    plugins=[
        send_egld(),
    ],
)
```

## Full MultiversX Wallet/Plugin Working Example

A full working example demonstrating all the capabilities of the MultiversX wallet and plugin using GOAT SDK can be found in the gist below

[GitHub Gist: MultiversX Example](https://gist.github.com/ofemeteng/b848e953bbcd6630ad325f81c7cb5fc6)

## Tools Available

- **get_address**: Retrieves the address of the wallet.
- **get_chain**: Gets the chain of the wallet.
- **get_balance**: Gets the balance of the wallet for a specified address.
- **sign_message**: Signs a message with the current account.
- **get_transaction_status**: Checks the status of a transaction using its hash.
- **get_fungible_tokens_balance**: Retrieves the fungible tokens (ESDT) balance of an address.
- **get_non_fungible_tokens_balance**: Retrieves the non-fungible tokens (NFTs) balance of an address.
- **deploy_token**: Deploys an ESDT token with specified parameters (name, ticker, initial supply, and decimals).
- **send_EGLD**: Sends EGLD to a specified address.

## Features

- Secure Key Management:
  - Seed phrase support
  - Address derivation

- Transaction Operations:
  - Transaction signing
  - Transaction sending
  - Status tracking
  - Signature verification

- Balance Management:
  - EGLD balance queries
  - Token account balance

- Network Support:
  - Mainnet
  - Testnet
  - Devnet

## License

This project is licensed under the terms of the MIT license.
