<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Cosmos Wallet for GOAT

## Installation
```
npm install @goat-sdk/wallet-cosmos
yarn add @goat-sdk/wallet-cosmos
pnpm add @goat-sdk/wallet-cosmos
```

## Usage

```typescript
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient} from "@cosmjs/stargate";

import { getOnChainTools } from "@goat-sdk/adapter-langchain";
import { cosmosbank } from "@goat-sdk/plugin-cosmosbank";
import { cosmos, CosmosWalletOptions } from "@goat-sdk/wallet-cosmos";

const mnemonic = (process.env.WALLET_MNEMONICS as `0x${string}`);
const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
    mnemonic,
    { prefix: "" } // e.g atom, pryzm, pokt, dora e.t.c 
    );
    
const [Account] = await wallet.getAccounts();
const rpcEndpoint = (process.env.RPC_PROVIDER_URL as `0x${string}`);
const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, wallet)

const walletClient : CosmosWalletOptions = {
    client : client,
    account : Account 
}

const tools = await getOnChainTools({
    wallet: cosmos(walletClient),
    plugins: [await cosmosbank()],
});

```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
<div>
</footer>