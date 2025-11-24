<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Balancer GOAT Plugin

Get quotes and swap on [Balancer](https://balancer.fi/)

## Installation
```bash
npm install @goat-sdk/plugin-balancer
yarn add @goat-sdk/plugin-balancer
pnpm add @goat-sdk/plugin-balancer
```

## Usage
```typescript
import { balancer } from '@goat-sdk/plugin-balancer';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       balancer({
            rpcUrl: process.env.RPC_URL,
       })
    ]
});
```

## Tools
* Swap tokens
* Add liquidity
* Remove liquidity

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
