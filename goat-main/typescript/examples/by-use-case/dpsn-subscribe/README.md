<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# Subscribe  to DPSN Topics
## 🚀 Quickstart

This example demonstrates how to use GOAT to get real-time events by **subscribing to dspn topics from the [DPSN Data Streams Store](https://streams.dpsn.org/)** 
. This example uses Binance BTC/USDT price tracking data feed from the dpsn streams
You can use this example with any other agent framework, chain, and wallet of your choice.

You can use this example with any other agent framework of your choice.

## Prerequisites
- An EVM wallet pvt key used for authentication , no on-chain transactions are invoked.

## Setup
1. Clone the repository:
```bash
git clone https://github.com/goat-sdk/goat.git
```

2. Go to the example directory:
```bash
cd typescript/examples/by-use-case/dpsn-subscribe
```

3. Copy the `.env.template` and populate with your values:
```bash
cp .env.template .env
```
- `OPENAI_API_KEY`
- `DPSN_URL`
- `EVM_WALLET_PVT_KEY`



4. Install dependencies:
```bash
pnpm install
```

## Usage
You can select dpsn topics to subscribe to from the [DPSN Data Streams Store](https://streams.dpsn.org/).



To provide personalized data streams for your agents, you can create and publish data into your own DPSN topics using the [dpsn-client for node](https://github.com/DPSN-org/dpsn-client-nodejs).


1. Run the plugin and invoke method directly to start consuming message:
```bash
pnpm example
```
2. Run with interactive CLI:
```bash
pnpm llm_example
```
  Chat with the agent:
  - Subscribe to topic 0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ticker
  - Unsubscribe to topic 0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ticker


## Using in production
In production, developers require advanced wallet setups that utilize [smart wallets](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-wallet/crossmint-smart-wallets), which allow them to:
1. **Increase security** by setting programmable permissions (e.g. limiting fund amounts, restricting contract interactions, and defining required signatures)
2. **Maintain regulatory compliance** by ensuring agent wallets are non-custodial. This means that:
     - Launchpads, wallet providers, or agent platforms never have access to agents' wallets.
     - Agent platforms do not require money transmitter licenses.

### Agent Wallets
[Crossmint](https://docs.crossmint.com/wallets/quickstarts/agent-wallets) offers one of the most advanced solutions for agent developers and launchpads: [Agent Wallets](https://docs.crossmint.com/wallets/quickstarts/agent-wallets).

To integrate Agent Wallets with GOAT, check out the following quickstarts:
1. Agent Wallets Quickstart [[EVM](https://github.com/goat-sdk/goat/tree/main/python/examples/by-wallet/crossmint), [Solana](https://github.com/goat-sdk/goat/tree/main/python/examples/by-wallet/crossmint)]
2. [Agent Launchpad Starter Kit](https://github.com/Crossmint/agent-launchpad-starter-kit/)

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
