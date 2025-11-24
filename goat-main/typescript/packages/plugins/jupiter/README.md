<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Jupiter GOAT Plugin

Swap tokens on [Jupiter](https://jup.ag/).

## Installation

```bash
npm install @goat-sdk/plugin-jupiter
yarn add @goat-sdk/plugin-jupiter
pnpm add @goat-sdk/plugin-jupiter
```


## Usage

```typescript
import { jupiter } from "@goat-sdk/plugin-jupiter";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        jupiter()
    ]
});
```

## Tools
- Get quote
- Swap

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
