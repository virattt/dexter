<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Fuel Wallet for GOAT

## Installation

```
npm install @goat-sdk/wallet-fuel
yarn add @goat-sdk/wallet-fuel
pnpm add @goat-sdk/wallet-fuel
```

## Usage

```typescript
import { Provider, Wallet } from "fuels";
import { fuel } from "@goat-sdk/wallet-fuel";
import { getOnChainTools } from "@goat-sdk/core";

const provider = await Provider.create(
    "https://mainnet.fuel.network/v1/graphql"
);

const tools = await getOnChainTools({
    wallet: fuel({
        privateKey: process.env.FUEL_WALLET_PRIVATE_KEY,
        provider,
    }),
});
```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>