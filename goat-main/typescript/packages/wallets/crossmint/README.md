<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Crossmint Utilities for GOAT

A set of tools and wallet clients for interacting with Crossmint APIs.

Wallet Clients:
1. **Smart Wallet**: Wallet client for interacting with Crossmint Smart Wallets
2. **Custodial Wallet**: Wallet client for interacting with Crossmint Custodial Wallets

Plugins:
1. **USDC Faucet**: Tools to top up your wallet with USDC on testnets
2. **Mint NFTs**: Tools to mint NFTs on Crossmint
3. **Create wallets**: Tools to create wallets for emails and X/Twitter accounts with Crossmint

## Installation
```
npm install @goat-sdk/wallet-crossmint
yarn add @goat-sdk/wallet-crossmint
pnpm add @goat-sdk/wallet-crossmint
```

## Usage

### Smart Wallet
```typescript
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { crossmint } from "@goat-sdk/crossmint";

const apiKey = process.env.CROSSMINT_STAGING_API_KEY;
const walletSignerSecretKey = process.env.SIGNER_WALLET_SECRET_KEY;
const alchemyApiKey = process.env.ALCHEMY_API_KEY_BASE_SEPOLIA;
const smartWalletAddress = process.env.SMART_WALLET_ADDRESS;

const { smartwallet } = crossmint(apiKey);

const tools = await getOnChainTools({
    wallet: await smartwallet({
        address: smartWalletAddress,
        signer: {
            secretKey: walletSignerSecretKey as `0x${string}`,
        },
        chain: "base-sepolia",
        provider: alchemyApiKey,
    }),
});
```

### Custodial Wallet
```typescript
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { crossmint } from "@goat-sdk/crossmint";
import { Connection } from "@solana/web3.js";

const apiKey = process.env.CROSSMINT_STAGING_API_KEY;
const email = process.env.EMAIL;

if (!apiKey || !email) {
    throw new Error("Missing environment variables");
}

const { custodial } = crossmint(apiKey);

const tools = await getOnChainTools({
    wallet: await custodial({
        chain: "solana",
        email: email,
        connection: new Connection(
            "https://api.devnet.solana.com",
            "confirmed"
        ),
    }),
});
```

### Faucet, Mint NFTs, Create wallets
```typescript
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { http } from "viem";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { viem } from "@goat-sdk/wallet-viem";
import { crossmint } from "@goat-sdk/crossmint";

const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.ALCHEMY_API_KEY),
    chain: sepolia,
});

const apiKey = process.env.CROSSMINT_STAGING_API_KEY;

const { faucet, mint, wallet } = crossmint(apiKey);

const tools = await getOnChainTools({
    plugins: [
        faucet(),
        mint(),
        wallet(),
    ],
});
```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>