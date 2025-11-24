<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Synth API GOAT Plugin

Interact with the [Synth API](https://synth.mode.network/) from [Mode Network](https://mode.network/).

## Installation
```
npm install @goat-sdk/plugin-synth-api
yarn add @goat-sdk/plugin-synth-api
pnpm add @goat-sdk/plugin-synth-api
```

## Usage
```typescript
import { synthApi } from "@goat-sdk/plugin-synth-api";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        synthApi(),
    ],
});
```

## Tools
- Get prediction of future possible bitcoin price

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
