<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# 1inch GOAT Plugin

Get balances for different tokens for a wallet using the [1inch API](https://1inch.io/page-api/).

## Installation
```bash
npm install @goat-sdk/plugin-1inch
yarn add @goat-sdk/plugin-1inch
pnpm add @goat-sdk/plugin-1inch
```

## Usage
```typescript
import { oneInch } from '@goat-sdk/plugin-1inch';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       oneInch({
            apiKey: process.env.ONEINCH_API_KEY // Get it from: https://portal.1inch.dev
       })
    ]
});
```

## Tools
* Get balances

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
