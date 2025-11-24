# Lulo Plugin for GOAT SDK

A plugin for the GOAT SDK that provides LULO deposit functionality.

## Installation

```bash
# Install the plugin
poetry add goat-sdk-plugin-lulo

# Install required wallet dependency
poetry add goat-sdk-wallet-solana
```

## Usage

```python
from goat_plugins.lulo import lulo, LuloPluginOptions

# Initialize the plugin
options = LuloPluginOptions()
plugin = lulo(options)
```

## Features

- Deposit USDC

## License

This project is licensed under the terms of the MIT license.
