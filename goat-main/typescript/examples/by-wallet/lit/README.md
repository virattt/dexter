<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# Using Lit wallets
## 🚀 Quickstart

This example demonstrates how to use GOAT with **[Lit wallets](https://developer.litprotocol.com)**.

You can use this example with any other agent framework, protocols and chains of your choice.

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
cd examples/by-wallet/lit
```

4. Copy the `.env.template` and populate with your values:
```bash
cp .env.template .env
```
- `OPENAI_API_KEY`
- `WALLET_PRIVATE_KEY`
- `RPC_PROVIDER_URL`

**Note:**
- From the `.env` file, the `WALLET_PRIVATE_KEY` must have Lit test tokens in order to mint a PKP and capacity credit
  - You can get test tokens from the [Lit Testnet Faucet](https://chronicle-yellowstone-faucet.getlit.dev/)
- From the `.env` file, the `SOLANA_PRIVATE_KEY` must have SOL on the Solana Devnet in order to fund the wrapped key
  - You can get SOL from the [Solana Devnet Faucet](https://faucet.solana.com/?cluster=devnet)
- From the `.env` file, the `ETH_PRIVATE_KEY` must have ETH on the Sepolia testnet in order to fund the wrapped key
  - You can get ETH from the [Sepolia Faucet](https://sepoliafaucet.com/)


## Usage
Run the EVM example:
```
pnpm ts-node src/evm.ts
```

Run the Solana example:

```
pnpm ts-node src/sol.ts
```

<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
