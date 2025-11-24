<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# DeBridge GOAT Plugin

[DeBridge](https://debridge.finance/) plugin for Goat. Allows you to create tools for bridging tokens across different chains using the DeBridge Liquidity Network (DLN).

## Installation
```
npm install @goat-sdk/plugin-debridge
yarn add @goat-sdk/plugin-debridge
pnpm add @goat-sdk/plugin-debridge
```

## Setup
    
```typescript
import { debridge } from "@goat-sdk/plugin-debridge";

// Using default DeBridge API URL
const plugin = debridge();

// Or with custom API URL
const plugin = debridge({
    baseUrl: process.env.DEBRIDGE_BASE_URL
});
```

## Tools

1. Create Bridge Order
2. Get Bridge Quote
3. Execute Bridge Transaction

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
