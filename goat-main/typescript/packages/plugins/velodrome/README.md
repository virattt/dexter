<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Velodrome GOAT Plugin

Swap tokens on [Velodrome](https://velodrome.finance/).

## Installation

```
npm install @goat-sdk/plugin-velodrome
yarn add @goat-sdk/plugin-velodrome
pnpm add @goat-sdk/plugin-velodrome
```

## Usage

```typescript
import { velodrome } from "@goat-sdk/plugin-velodrome";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [velodrome()],
});
```

## Advanced Usage with ERC20 Plugin

For improved integration to work seamlessly with the ERC20 plugin, you can configure your tools as follows:

```typescript
import { modeGovernance } from "@goat-sdk/plugin-mode-governance";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        modeGovernance()
    ]
});
```

## Tools

- Add liquidity
- Swap tokens

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
