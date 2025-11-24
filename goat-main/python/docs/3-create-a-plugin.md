# How to create a plugin
GOAT plugins enable your agent to interact with various blockchain protocols.

Plugins can be chain-specific (EVM, Solana, etc.) or chain-agnostic. If a plugin is chain-specific it will fail to compile when being used with a wallet of a different chain.

You can see all available plugins [here](https://github.com/goat-sdk/goat/tree/main#tools).

## Using the Plugin Generator

Run the plugin generator script from the `python` directory:

```bash
cd python
python scripts/create_plugin.py <plugin-name> [--evm]
```

Options:

-   `<plugin-name>`: Name of your plugin (e.g., 'my-token', 'my-service')
-   `--evm`: Optional flag to indicate if the plugin is EVM-compatible

Examples:

1. Create an EVM-compatible plugin:

```bash
python scripts/create_plugin.py my-token --evm
```

2. Create a chain-agnostic plugin:

```bash
python scripts/create_plugin.py my-service
```

The script generates a complete plugin package with the following structure:

```
src/plugins/<plugin-name>/
├── pyproject.toml          # Project configuration and dependencies
├── README.md              # Plugin documentation
└── goat_plugins/<plugin-name>/
    ├── __init__.py       # Plugin initialization and configuration
    ├── parameters.py     # Pydantic parameter models
    └── service.py        # Service implementation with Tool decorators
```

## Manual Creation

### 1. Define your plugin extending the [PluginBase](https://github.com/goat-sdk/goat/tree/main/python/src/goat_sdk/goat/classes/plugin_base.py) class.

```python
from goat.classes.plugin_base import PluginBase

# For a chain-agnostic plugin we use the WalletClientBase interface, for a chain-specific plugin we use the EVMWalletClient, SolanaWalletClient, or corresponding interfaces
class MyPlugin(PluginBase[WalletClientBase]):
    def __init__(self):
        # We define the name of the plugin
        super("myPlugin", []);

    # We define the chain support for the plugin, in this case we support all chains
    def supports_chain(self, chain: Chain) -> bool:
        return True

# We export a factory function to create a new instance of the plugin
my_plugin = () => MyPlugin()
```

### 2. Add tools to the plugin

You can create a class and decorate its methods with the `@Tool` decorator to create tools.

The tool methods will receive the wallet client as the first argument and the parameters as the second argument.

```python
from pydantic import BaseModel, Field

class SignMessageParameters(BaseModel):
    message: str = Field(..., description="The message to sign")

class MyTools {
    @Tool({
        "name": "sign_message",
        "description": "Sign a message",
        "parameters_schema": SignMessageParameters
    })
    async def sign_message(self, walletClient: WalletClientBase, parameters: dict):
        signed = await walletClient.sign_message(parameters.message);
        return signed.signed_message;
    }
```

Once we have our class we now need to import it in our plugin class.

```python
class MyPlugin(PluginBase[WalletClientBase]):
    def __init__(self):
        # We define the name of the plugin
        super("myPlugin", [MyTools()]);

    # We define the chain support for the plugin, in this case we support all chains
    def supports_chain(self, chain: Chain) -> bool:
        return True
}

# We export a factory function to create a new instance of the plugin
my_plugin = () => MyPlugin()
```

### 3. Add the plugin to the agent

```python
tools = get_on_chain_tools(
    wallet=wallet,
    plugins=[my_plugin]
)
```

### Next steps

-   Share your plugin with others!
-   Open a PR to add it to the [plugins registry](https://github.com/goat-sdk/goat/tree/main/python/src/plugins) in the [GOAT SDK](https://github.com/goat-sdk/goat).
