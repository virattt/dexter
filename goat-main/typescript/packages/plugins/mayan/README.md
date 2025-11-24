<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Mayan GOAT Plugin

Cross-chain token swap using [Mayan SDK](https://github.com/mayan-finance/swap-sdk) (Solana, EVM, SUI).

## Installation
```bash
npm install @goat-sdk/plugin-mayan
yarn add @goat-sdk/plugin-mayan
pnpm add @goat-sdk/plugin-mayan
```

## Usage
```typescript
import { mayan } from '@goat-sdk/plugin-mayan';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       mayan()
    ]
});
```

## Tools
- Swap from Solana to Solana, EVM, SUI
- Swap from EVM to EVM, Solana, SUI

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
