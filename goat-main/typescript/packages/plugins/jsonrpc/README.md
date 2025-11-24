<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# JSON RPC GOAT Plugin

Make easy to call JSON RPC methods.

## Installation

```bash
npm install @goat-sdk/plugin-jsonrpc
yarn add @goat-sdk/plugin-jsonrpc
pnpm add @goat-sdk/plugin-jsonrpc
```


## Usage

```typescript
import { jsonrpc } from "@goat-sdk/plugin-jsonrpc";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        jsonrpc()
    ]
});
```

## Tools

- Call JSON RPC methods

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
