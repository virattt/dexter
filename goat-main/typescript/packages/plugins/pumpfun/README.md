<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Pump.fun GOAT Plugin

Create and buy tokens on [Pump.fun](https://pump.fun/).

## Installation
```
npm install @goat-sdk/plugin-pumpfun
yarn add @goat-sdk/plugin-pumpfun
pnpm add @goat-sdk/plugin-pumpfun
```

## Setup

```typescript
import { pumpfun } from "@goat-sdk/plugin-pumpfun";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        pumpfun(),
    ],
});
```

## Tools
- Create and buy the created token

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
