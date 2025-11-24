<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Crossmint Headless Checkout GOAT Plugin

Purchase any NFT with [Crossmint Checkout](https://crossmint.com/)

## Installation
```bash
npm install @goat-sdk/plugin-crossmint-headless-checkout
yarn add @goat-sdk/plugin-crossmint-headless-checkout
pnpm add @goat-sdk/plugin-crossmint-headless-checkout
```

## Usage

```typescript
import { crossmintHeadlessCheckout } from "@goat-sdk/plugin-crossmint-headless-checkout";



const tools = await getOnChainTools({
    wallet: // ...
    plugins: [crossmintHeadlessCheckout({
        apiKey: process.env.CROSSMINT_API_KEY // Get it from: https://crossmint.com/
    })]
});
```

## Tools
* Buy token

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
