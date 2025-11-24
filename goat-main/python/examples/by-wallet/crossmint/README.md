<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# CrossmintSmart Wallets
## 🚀 Quickstart

This example demonstrates the usage of different wallet types with Crossmint's API:
- Smart EVM Wallet
- Custodial Solana Wallet
- Smart Solana Wallet

## Setup

1. Copy the `.env.template` and populate with your values:

```bash
cp .env.template .env
```

2. Set up your environment variables in `.env`:

-   `OPENAI_API_KEY`: Your OpenAI API key with access to GPT-4 models (the example uses gpt-4o-mini model for LangChain)

-   `CROSSMINT_API_KEY`: Your Crossmint API key with the scopes needed for the example:

    -   `wallets.create` - Required for creating the smart wallet
    -   `wallets.read` - Required for retrieving wallet information
    -   `wallets:balance.read` - Required for checking wallet balance
    -   `wallets:messages.sign` - Required for signing messages

    To obtain the API key:

    1. Go to [Crossmint Console](https://staging.crossmint.com/console) (staging) or [Production Console](https://www.crossmint.com/console)
    2. Create a new Smart Wallet project
    3. Navigate to the API Keys section
    4. Create a new API key with the required scopes listed above

-   `CROSSMINT_BASE_URL`: The Crossmint API base URL:

    -   For staging projects: `https://staging.crossmint.com`
    -   For production projects: `https://www.crossmint.com`
        Make sure this matches the environment where you created your project and API key.

-   `SIGNER_WALLET_SECRET_KEY`: The private key of your EVM wallet that will be the admin signer

-   `EVM_PROVIDER_URL`: Your RPC provider URL for the Base network

    -   Can be obtained from any EVM-compatible RPC provider (Infura, Alchemy, QuickNode, etc.)
    -   Must support the Base network

-   `ENS_PROVIDER_URL`: Your RPC provider URL for ENS resolution
    -   Usually the same as your `EVM_PROVIDER_URL`
    -   Required for resolving ENS names if used in transactions

3. Install dependencies:

```bash
poetry install --no-root
```

## Smart EVM Wallet Example

This example demonstrates how to:

1. Create a new Smart Wallet using Crossmint's API
2. Use the created wallet with LangChain to perform various on-chain operations

To run the example:

```bash
poetry run python smart_evm_wallet_example.py
```

### How it works

1. The script first creates a new Smart Wallet using your provided signer wallet as the admin
2. The created Smart Wallet can then be used to perform various operations through LangChain:
    - Send ETH
    - Interact with ERC20 tokens (USDC, PEPE)
    - And more...

### Security Notes

-   Never share or commit your private keys or API keys. Always keep them secure and use environment variables.
-   When using Smart Wallets, you must use a client-side API key as per Crossmint's requirements.
-   Make sure to keep your signer wallet's private key secure as it has admin rights over the smart wallet.

## Other Examples

```bash
poetry run python custodial_solana_wallet_example.py
```

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
