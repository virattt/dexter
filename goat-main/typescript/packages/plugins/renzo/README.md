<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Renzo GOAT Plugin

Restake tokens on [Renzo](https://www.renzoprotocol.com/).

## Installation
```
npm install @goat-sdk/plugin-renzo
yarn add @goat-sdk/plugin-renzo
pnpm add @goat-sdk/plugin-renzo
```

## Setup
```typescript
import { renzo } from "@goat-sdk/plugin-renzo";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        renzo(),
    ],
});
```

## Tools
- Deposit ERC20 tokens
- Deposit ETH
- Get Renzo deposit address

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
