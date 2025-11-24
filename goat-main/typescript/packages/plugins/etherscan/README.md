<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Etherscan GOAT Plugin

This plugin enables your agent to interact with the Ethereum blockchain data from [Etherscan](https://etherscan.io/).

## Installation

```bash
npm install @goat-sdk/plugin-etherscan
yarn add @goat-sdk/plugin-etherscan
pnpm add @goat-sdk/plugin-etherscan
```

## Usage

```typescript
import { etherscan } from "@goat-sdk/plugin-etherscan";

const tools = getOnChainTools({
  plugins: [
    etherscan({
      apiKey: "YOUR_ETHERSCAN_API_KEY",
    }),
  ],
});
```

## Tools

- Account balance and transaction history
- Contract ABI and source code retrieval
- Transaction status and receipt information
- Block data
- Token balances and transfers
- Gas price tracking
- Event logs

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
