<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Ionic GOAT Plugin

[Ionic](https://ionic.money/) plugin for GOAT. Allows you to create tools for interacting with the Ionic protocol.

## Installation

```bash
npm install @goat-sdk/plugin-ionic
yarn add @goat-sdk/plugin-ionic
pnpm add @goat-sdk/plugin-ionic
```


## Usage

```typescript
import { ionic } from "@goat-sdk/plugin-ionic";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        ionic()
    ]
});
```

## Tools

- Borrow and supply assets
- Loop assets
- Swap collateral

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
