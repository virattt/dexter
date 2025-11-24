# Web3 Wallet for GOAT SDK

A Python implementation of a Web3 wallet for the GOAT SDK, providing enhanced Ethereum and EVM-compatible chain support through web3.py integration.

## Installation

```bash
poetry add goat-sdk-wallet-web3

# Required dependency
poetry add goat-sdk-wallet-evm
```

## Usage

```python
from goat_wallets.web3 import web3
from goat_wallets.evm import USDC, PEPE

# Initialize wallet with private key and token support
wallet = web3(
    w3_provider="${RPC_PROVIDER_URL}",  # Your EVM RPC endpoint
    tokens=[USDC, PEPE],  # Enable ERC20 token functionality
    enable_send=True      # Enable token sending capability
)

# Get wallet address
address = wallet.get_address()

# Get native token balance
balance = await wallet.get_balance()

# Send transaction
tx_hash = await wallet.send_transaction({
    "to": "recipient_address",
    "value": "1000000000000000000",  # 1 ETH in wei
    "data": "0x",  # Optional contract data
    "gas": 21000,  # Optional gas limit
    "maxFeePerGas": "50000000000"  # Optional max fee per gas (50 gwei)
})

# Call contract method
result = await wallet.call_contract(
    contract_address="contract_address",
    function_name="balanceOf",
    args=["token_holder_address"]
)
```

## Features

- Web3.py Integration:
  - Full web3.py functionality
  - Enhanced contract interactions
  - ABI handling
  - Gas estimation
  
- Transaction Management:
  - EIP-1559 support
  - Legacy transaction support
  - Contract deployment
  - Method encoding/decoding
  
- Smart Contract Features:
  - Contract interaction
  - Event listening
  - Function calling
  - State queries
  
- Network Support:
  - Ethereum
  - Polygon
  - Arbitrum
  - Optimism
  - Base
  - BNB Chain
  - All EVM-compatible chains

## License

This project is licensed under the terms of the MIT license.
