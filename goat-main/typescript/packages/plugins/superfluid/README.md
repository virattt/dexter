<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Superfluid GOAT Plugin

Interact with the [Superfluid Protocol](https://docs.superfluid.finance/).

## Installation
```
npm install @goat-sdk/plugin-superfluid
yarn add @goat-sdk/plugin-superfluid
pnpm add @goat-sdk/plugin-superfluid
```

## Setup
    
```typescript
import { superfluid } from "@goat-sdk/plugin-superfluid";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        superfluid(),
    ],
});
```

## Tools
- Create or Update or Delete Flow
- Get Flow Rate
- Get Units
- Update Member Units
- Get Total Flow Rate

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
