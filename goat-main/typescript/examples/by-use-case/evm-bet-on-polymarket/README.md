<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# Bet on Polymarket
## 🚀 Quickstart

This example demonstrates how to use GOAT to **bet on [Polymarket](https://polymarket.com/)** on the Polygon network.

You can use this example with any other agent framework of your choice.

## Prerequisites
- A wallet with:
   - Some MATIC for gas fees (0.1 MATIC should be enough)
   - USDC.e tokens for trading (not regular USDC, see contract [here](https://polygonscan.com/address/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174))

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
cd examples/by-use-case/evm-bet-on-polymarket
```

4. Copy the `.env.template` and populate with your values:
```bash
cp .env.template .env
```
- `OPENAI_API_KEY`
- `WALLET_PRIVATE_KEY`
- `RPC_PROVIDER_URL`

The following values will be populated in the next step:
  - `POLYMARKET_API_KEY`
  - `POLYMARKET_SECRET`
  - `POLYMARKET_PASSPHRASE`

5. Create an API key for your wallet using Polymarket's API key creation tool:
```bash
pnpm polymarket:api-key
```

6. Copy the API key response values into your `.env` file:
   - `POLYMARKET_API_KEY`
   - `POLYMARKET_SECRET`
   - `POLYMARKET_PASSPHRASE`

7. Set up token allowances for trading. This approval lets the exchanges move tokens on your behalf:
```bash
pnpm polymarket:setup-allowance
```

## Usage
1. Run the interactive CLI:
```bash
pnpm ts-node index.ts
```

2. Chat with the agent:
* List events that have not closed yet
* Purchase a position on an event
* List all my active orders
* Cancel all my active orders

## Available Actions
- `Get events`: Get a list of events filtered by date, liquidity, slug, etc.
- `Get market info`: Get info about a specific market using the market id
- `Create an order`: Create an order for a specific market. Specify the type of order (FOK - Fill or Kill, GTC - Good Till Canceled, GTD - Good Till Date), the market id, the side (buy or sell), the price, the quantity and the expiration date.
- `List all my active orders`: List all your active orders
- `Cancel an order`: Cancel an order using the order id
- `Cancel all my active orders`: Cancel all your active orders

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
