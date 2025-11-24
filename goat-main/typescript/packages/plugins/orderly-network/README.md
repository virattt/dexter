<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# OrderlyNetwork GOAT Plugin

Brief description of the OrderlyNetwork plugin and what it does

## Installation

```bash
npm install @goat-sdk/plugin-orderly-network
yarn add @goat-sdk/plugin-orderly-network
pnpm add @goat-sdk/plugin-orderly-network
```

## Usage

```typescript
import { orderlynetwork } from '@goat-sdk/plugin-orderly-network';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       orderlynetwork()
    ]
});
```

## Advanced Usage with ERC20 Plugin

For improved integration to work seamlessly with the ERC20 plugin, you can configure your tools as follows:

```typescript
import { orderlynetwork } from "@goat-sdk/plugin-orderly-network";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [orderlynetwork()],
});
```

## Tools

- Deposit USDC into Orderly Network
- Withdraw USDC from Orderly Network
- Create an order at Orderly Network
- Close a position at Orderly Network
- Get allowed symbol by network and token
- Get the info of the USDC token
- Get balance of user token holdings in Orderly

## Configuration

### Environment Variables

The plugin requires some common environment variables and additional chain-specific variables depending on your chosen chain mode.

---

## Common Configuration

### Core Orderly Configuration

```bash
ORDERLY_PRIVATE_KEY=           # Your private key for signing transactions (ed25519 format)
ORDERLY_BROKER_ID=demo         # Your broker ID (default: demo)
ORDERLY_NETWORK=testnet        # Network to connect to (testnet or mainnet)
ORDERLY_CHAIN_MODE=            # Chain mode to use (evm or solana)
```

You can generate your Orderly private key using the [Orderly Broker Registration Tool](https://orderlynetwork.github.io/broker-registration/). This tool will provide you with the necessary credentials to interact with the Orderly Network.

---

## EVM Chain Configuration

If using `ORDERLY_CHAIN_MODE=evm`, set these variables:

```bash
# EVM Configuration
EVM_PRIVATE_KEY=               # Your EVM wallet private key
EVM_PROVIDER_URL=              # Default RPC URL for mainnet (optional)

# RPC URLs for each chain you want to use
# Replace <chainname> with the uppercase chain name (e.g., ARBITRUMSEPOLIA, OPTIMISM, etc.)
ETHEREUM_PROVIDER_<chainname>=  # RPC URL for the specific chain

# Examples:
ETHEREUM_PROVIDER_ARBITRUMSEPOLIA=https://sepolia-rollup.arbitrum.io/rpc
ETHEREUM_PROVIDER_OPTIMISM=https://mainnet.optimism.io
ETHEREUM_PROVIDER_BASE=https://mainnet.base.org
```

For each EVM chain you specify in your character configuration, you must provide a corresponding RPC URL in the environment variables. The environment variable name should be `ETHEREUM_PROVIDER_` followed by the chain name in uppercase.

---

## Solana Chain Configuration

If using `ORDERLY_CHAIN_MODE=solana`, set these variables:

```bash
# Solana Configuration
SOLANA_PRIVATE_KEY=            # Your Solana wallet private key (base58 encoded)
```

The plugin will automatically:

- Derive your public key from the private key.
- Use the appropriate Solana RPC endpoints based on your `ORDERLY_NETWORK` setting:
    - For `ORDERLY_NETWORK=mainnet`: [https://api.mainnet-beta.solana.com](https://api.mainnet-beta.solana.com)
    - For `ORDERLY_NETWORK=testnet`: [https://api.devnet.solana.com](https://api.devnet.solana.com)

```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
```
