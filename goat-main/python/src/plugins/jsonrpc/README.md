# JSON-RPC Plugin for GOAT SDK

A plugin for the GOAT SDK that enables making JSON-RPC calls to any blockchain or protocol endpoint supporting the JSON-RPC 2.0 specification.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-jsonrpc

# Install optional wallet dependencies for chain-specific operations
poetry add goat-sdk-wallet-evm
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.jsonrpc import jsonrpc, JSONRpcPluginOptions

# Initialize the plugin for EVM chain
evm_options = JSONRpcPluginOptions(
    endpoint="${RPC_PROVIDER_URL}"  # Your EVM RPC endpoint
)
evm_plugin = jsonrpc(evm_options)

# Get latest block number on Ethereum
eth_response = await evm_plugin.call({
    "method": "eth_blockNumber",
    "params": [],
    "id": 1,
    "jsonrpc": "2.0"
})

# Initialize plugin for Solana
sol_options = JSONRpcPluginOptions(
    endpoint="${RPC_PROVIDER_URL}"  # Your Solana RPC endpoint
)
sol_plugin = jsonrpc(sol_options)

# Get account info on Solana
sol_response = await sol_plugin.call({
    "method": "getAccountInfo",
    "params": [
        "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg",
        {"encoding": "base58"}
    ],
    "id": 1,
    "jsonrpc": "2.0"
})
```

## Features

- Protocol Support:
  - JSON-RPC 2.0 specification
  - WebSocket connections
  - Batch requests
  - Error handling
  
- Chain Compatibility:
  - Ethereum and EVM chains
  - Solana
  - Any JSON-RPC compatible chain
  
- Advanced Features:
  - Async implementation
  - Request retries
  - Rate limiting
  - Response validation
  
- Integration Support:
  - GOAT SDK integration
  - LangChain compatibility
  - Custom middleware support
  - Error event handling

## License

This project is licensed under the terms of the MIT license.
