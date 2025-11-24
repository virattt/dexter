# Installation and Usage

## Installation

1. Install the core package

```bash
npm install @goat-sdk/core
```

1. Depending on the type of wallet you want to use, install the corresponding wallet (see all wallets [here](https://github.com/goat-sdk/goat/tree/main#chains-and-wallets)):

```bash
npm install @goat-sdk/wallet-solana
```

1. Install the plugins for the protocols you need (see all available plugins [here](https://github.com/goat-sdk/goat/tree/main#tools))

```bash
npm install @goat-sdk/plugin-jupiter
```

4. Install the adapter for the agent framework you want to use (see all available adapters [here](https://github.com/goat-sdk/goat/tree/main#agent-frameworks))

```bash
npm install @goat-sdk/adapter-vercel-ai
```

## Usage

1. Configure your wallet

```typescript
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection(process.env.SOLANA_RPC_URL as string);
const keypair = Keypair.fromSecretKey(
    base58.decode(process.env.SOLANA_PRIVATE_KEY as string),
);
```

2. Configure your tools for the framework you want to use

```typescript
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { solana } from "@goat-sdk/wallet-solana";
import { jupiter } from "@goat-sdk/plugin-jupiter";

const tools = await getOnChainTools({
    wallet: solana({
        keypair,
        connection,
    }),
    plugins: [jupiter()],
});
```

3. Plug into your agent framework

```typescript
const result = await generateText({
    model: openai("gpt-4o-mini"),
    tools: tools,
    maxSteps: 10,
    prompt: "Swap 10 USDC for JLP",
});

console.log(result);
```

For concrete examples of how to use GOAT checkout our [quickstart guides](https://github.com/goat-sdk/goat/tree/main#-quickstarts).
