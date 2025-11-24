<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# ENS GOAT Plugin

Resolve [ENS](https://ens.domains/) names to addresses.

## Installation
```bash
npm install @goat-sdk/plugin-ens
yarn add @goat-sdk/plugin-ens
pnpm add @goat-sdk/plugin-ens
```

## Usage
```typescript
import { ens } from "@goat-sdk/plugin-ens";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        ens({
            provider: // Your provider url
        })
    ]
});
```

## Tools
1. Get address from ENS name

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
