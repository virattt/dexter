
<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# ChatGPT
## 🚀 Quickstart

This example demonstrates how to use GOAT to allow a [ChatGPT](https://chatgpt.com) agent to **send and receive ETH and ERC-20 tokens as well as optionally purchasing items on Amazon US** on EVM networks. This example uses [Base](https://base.org) but you can implement it with any other EVM network by changing the chain and RPC URL.

You can use this example with any other agent framework, chain, and wallet of your choice.

## 🚨 Note
This example is for demonstration purposes only. It is not made to use in production!

## How it works
ChatGPT allows you to create GPTs that can use external tools via API calls. This demo will generate a REST API server that will have:
1. An endpoint for each GOAT tool you install.
2. An endpoint to list all available tools and their parameters.
3. An OpenAPI specification endpoint to visualize the API.

This API can then be exposed with ngrok and connected to your own GPT.

## Requirements
1. A ChatGPT account.
2. ngrok installed and configured.

## Setup
1. Clone the repository:
```bash
git clone https://github.com/goat-sdk/goat.git && cd goat
```

2. Run the following commands from the `typescript` directory:
```bash
cd typescript
pnpm install
pnpm build
```

3. Go to the example directory:
```bash
cd examples/by-framework/chatgpt
```

4. Copy the `.env.template` and populate with your values:
```bash
cp .env.template .env
```
- `OPENAI_API_KEY`
- `WALLET_PRIVATE_KEY`
- `RPC_PROVIDER_URL`

## Usage
1. Run the interactive CLI:
```bash
pnpm ts-node index.ts
```

2. Expose the API with ngrok:
```bash
ngrok http http://localhost:3000
```

3. Go to the ChatGPT, click on "Explore GPTs" and there click on "Create".

4. Give your GPT a name and description.

5. Click on "Create new action"

6. Click on import from URL and paste the ngrok URL with this path:
```
https://<ngrok-url>/api-docs/openapi.json
```

7. All tools should now be visible in the GPT.

8. Save your GPT and you should be able to use the tools in the chat:
- Check your balance for ERC-20 tokens
- Send ERC-20 tokens to another address
- Check your balance again to see the tokens you just sent.

## Using in production
In production, developers require advanced wallet setups that utilize [smart wallets](https://docs.goat-sdk.com/concepts/smart-wallets), which allow them to:
1. **Increase security** by setting programmable permissions (e.g. limiting fund amounts, restricting contract interactions, and defining required signatures)
2. **Maintain regulatory compliance** by ensuring agent wallets are non-custodial. This means that:
     - Launchpads, wallet providers, or agent platforms never have access to agents' wallets.
     - Agent platforms do not require money transmitter licenses.

### Agent Wallets
[Crossmint](https://docs.crossmint.com/wallets/quickstarts/agent-wallets) offers one of the most advanced solutions for agent developers and launchpads: [Agent Wallets](https://docs.crossmint.com/wallets/quickstarts/agent-wallets).

To integrate Agent Wallets with GOAT, check out the following quickstarts:
1. Agent Wallets Quickstart [[EVM](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-wallet/crossmint-smart-wallets), [Solana](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-wallet/crossmint-smart-wallets)]
2. [Agent Launchpad Starter Kit](https://github.com/Crossmint/agent-launchpad-starter-kit/)




<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
