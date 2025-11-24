# Goat JsonRpc Plugin 🐐 - TypeScript

JsonRpc plugin for [Goat 🐐](https://ohmygoat.dev). Use this plugin to make Rpc calls to endpoints.

## Installation
```
npm install @goat-sdk/plugin-jsonrpc
```

## Usage

```typescript
import { jsonrpc } from "@goat-sdk/plugin-jsonrpc";


const plugin = jsonrpc({
    endpoint: process.env.ENDPOINT_URL as string,
});
```

## Available Actions

### Call A Method
- Make rpc call to an on chain method using an agent and a  chat model e.g input  
    -`make a JSONRpc call with this method {{ eth_blockNumber }}` 


## Goat

<div align="center">
Go out and eat some grass.

[Docs](https://ohmygoat.dev) | [Examples](https://github.com/goat-sdk/goat/tree/main/typescript/examples) | [Discord](https://discord.gg/2F8zTVnnFz)</div>

## Goat 🐐
Goat 🐐 (Great Onchain Agent Toolkit) is an open-source library enabling AI agents to interact with blockchain protocols and smart contracts via their own wallets.
