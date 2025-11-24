<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# ZeroDev Global Address Plugin

Create global addresses that can receive tokens from multiple chains with [ZeroDev](https://docs.zerodev.app/global-address).

## Installation

```
npm install @goat-sdk/plugin-zerodev-global-address
yarn add @goat-sdk/plugin-zerodev-global-address
pnpm add @goat-sdk/plugin-zerodev-global-address
```

## Usage

```typescript
import { zeroDevGlobalAddress } from "@goat-sdk/plugin-zerodev-global-address";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [zeroDevGlobalAddress()],
});
```

## Tools

- Create global addresses that can receive tokens from multiple chains
- Automatic token bridging to your destination chain
- Support for multiple chains:
  - Ethereum Mainnet
  - Polygon
  - Optimism
  - Arbitrum
  - Base
  - Scroll
  - Mode
- Support for different token types:
  - Native tokens
  - ERC20 tokens
  - USDC
  - Wrapped native tokens

## Examples

* `Create a global address` - creates a global address using the connected wallet settings.
* `Create a global address on base` - creates a global address on the Base chain.
* `Create a global address for wallet 0x123...abc` - creates a global address for the specific owner address.
* `Create a global address on arbitrum with 30% slippage` - creates a global address on Arbitum with a slippage of 30% (default slippage is 15%).

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
