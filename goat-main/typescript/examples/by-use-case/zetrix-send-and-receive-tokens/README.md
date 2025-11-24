
<div align="center">
<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</div>

# Zetrix
## 🚀 Quickstart

This example demonstrates how to use GOAT to **send ZETRIX and check ZETRIX balance** on Zetrix. This example uses [Zetrix testnet](https://test-explorer.zetrix.com).

You can use this example with any other agent framework, chain, and wallet of your choice.

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
cd examples/by-use-case/zetrix-send-and-receive-tokens
```

4. Copy the `.env.template` and populate with your values:
```bash
cp .env.template .env
```
- `OPENAI_API_KEY`
- `ZETRIX_ACCOUNT`
- `ZETRIX_ACCOUNT_PRIVATE_KEY`

5. Add some test funds to your wallet by going to any [Base Sepolia Faucet](https://faucet.zetrix.com/)

## Usage
1. Run the interactive CLI:
```bash
pnpm ts-node index.ts
```

2. Chat with the agent:
- Check ZETRIX balance of any address
- Send ZETRIX to another address
- Give you summary of the transaction (pre/post transaction balance, transaction summary)
<footer>
<br/>
<br/>
<div>
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">

<div>
</footer>
