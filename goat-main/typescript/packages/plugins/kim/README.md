<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Kim GOAT Plugin

Swap and manage liquidity positions on [Kim](https://kim.exchange/).

## Installation

```bash
npm install @goat-sdk/plugin-kim
yarn add @goat-sdk/plugin-kim
pnpm add @goat-sdk/plugin-kim
```


## Usage

```typescript
import { kim } from "@goat-sdk/plugin-kim";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        kim()
    ]
});
```

## Tools
- Swap in a single or multiple hops
- Create liquidity positions and manage them

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
