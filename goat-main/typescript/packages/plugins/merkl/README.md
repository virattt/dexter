<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Merkl GOAT Plugin
Claim rewards from [Merkl](https://merkl.xyz/)

## Installation

```bash
npm install @goat-sdk/plugin-merkl
yarn add @goat-sdk/plugin-merkl
pnpm add @goat-sdk/plugin-merkl
```

## Usage

```typescript
import { merkl } from "@goat-sdk/plugin-merkl";

const tools = await getOnChainTools({
    wallet: viem(wallet),
    plugins: [
        merkl(),
    ],
});
```

## Tools
- Claim rewards from Merkl

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
