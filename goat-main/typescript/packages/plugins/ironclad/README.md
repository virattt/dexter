<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Ironclad GOAT Plugin

[Ironclad](https://ironclad.finance/) plugin for GOAT. Allows you to create tools for interacting with the Ironclad protocol.

## Installation

```bash
npm install @goat-sdk/plugin-ironclad
yarn add @goat-sdk/plugin-ironclad
pnpm add @goat-sdk/plugin-ironclad
```


## Usage

```typescript
import { ironclad } from "@goat-sdk/plugin-ironclad";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        ironclad()
    ]
});
```

## Tools

- Loop assets
- Borrow and supply iUSD
- Get health metrics
- Monitor positions
- Calculate max withdrawable amount

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
