<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Polymarket GOAT Plugin
Make bets and get market data from [Polymarket](https://polymarket.com/).

## Installation
```
npm install @goat-sdk/plugin-polymarket
yarn add @goat-sdk/plugin-polymarket
pnpm add @goat-sdk/plugin-polymarket
```

## Usage

**Follow the instructions in the [example](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-bet-on-polymarket) to get your API key** and start using the plugin:
```typescript
import { polymarket } from "@goat-sdk/plugin-polymarket";


const plugin = polymarket({
    credentials: {
        key: process.env.POLYMARKET_API_KEY as string,
        secret: process.env.POLYMARKET_SECRET as string,
        passphrase: process.env.POLYMARKET_PASSPHRASE as string,
    },
});
```

## Tools
- Get events
- Get market info
- Create order
- Get active orders
- Cancel order
- Cancel all orders

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a> 
</div>
</footer>
