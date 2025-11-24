# How to create a plugin
GOAT plugins enable your agent to interact with various blockchain protocols. 

Plugins can be chain-specific (EVM, Solana, etc.) or chain-agnostic. If a plugin is chain-specific it will fail to compile when being used with a wallet of a different chain.

You can see all available plugins [here](#plugins).

## Using the Plugin Generator
Use the `create-plugin` command to generate all the necessary files and configuration for a new plugin

```bash
# Create a plugin with default type (any)
pnpm create-plugin -n your-plugin-name

# Create a plugin for a specific chain type
pnpm create-plugin -n your-plugin-name -t evm  # For EVM chains
pnpm create-plugin -n your-plugin-name -t solana  # For Solana
```
The command will generate:
- A `package.json` with standard metadata and dependencies
- TypeScript configuration files (`tsconfig.json`, `tsup.config.ts`)
- A basic plugin structure in the `src` directory:
  - `parameters.ts` - Example parameters using Zod schema
  - `your-plugin-name.service.ts` - Service class with an example tool
  - `your-plugin-name.plugin.ts` - Plugin class extending PluginBase
  - `index.ts` - Exports for your plugin


## Manual Creation
### 1. Define your plugin extending the [PluginBase](https://github.com/goat-sdk/goat/tree/main/typescript/packages/core/src/classes/PluginBase.ts) class.

```typescript
import { PluginBase, WalletClientBase } from "@goat-sdk/core";

// For a chain-agnostic plugin we use the WalletClientBase interface, for a chain-specific plugin we use the EVMWalletClient, SolanaWalletClient, or corresponding interfaces
export class MyPlugin extends PluginBase<WalletClientBase> {
    constructor() {
        // We define the name of the plugin
        super("myPlugin", []);
    }

    // We define the chain support for the plugin, in this case we support all chains
    supportsChain = (chain: Chain) => true;
}

// We export a factory function to create a new instance of the plugin
export const myPlugin = () => new MyPlugin();
```

### 2. Add tools to the plugin
    
There are two ways to add tools to the plugin:
1. Using the `@Tool` decorator on our own class
2. Using the `getTools` and `createTool` functions to create tools dynamically

#### Option 1: Using the `@Tool` decorator
The `@Tool` decorator is a way to create tools in a more declarative way.

You can create a class and decorate its methods with the `@Tool` decorator to create tools.

The tool methods will receive the wallet client as the first argument and the parameters as the second argument.

```typescript
import { Tool } from "@goat-sdk/core";
import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class SignMessageParameters extends createToolParameters(
    z.object({
        message: z.string(),
    }),
) {}

class MyTools {
    @Tool({
        name: "sign_message",
        description: "Sign a message",
    })
    async signMessage(walletClient: WalletClientBase, parameters: SignMessageParameters) {
        const signed = await walletClient.signMessage(parameters.message);
        return signed.signedMessage;
    }
}
```

Once we have our class we now need to import it in our plugin class.

```typescript
export class MyPlugin extends PluginBase<WalletClientBase> {
    constructor() {
        // We define the name of the plugin
        super("myPlugin", [new MyTools()]);
    }

    // We define the chain support for the plugin, in this case we support all chains
    supportsChain = (chain: Chain) => true;
}

// We export a factory function to create a new instance of the plugin
export const myPlugin = () => new MyPlugin();
```

#### Option 2: Using the `getTools` and `createTool` functions
We will implement the `getTools` method in our plugin class.

Inside the method, we will return an array of tools created using the `createTool` function.

```typescript
import { PluginBase, WalletClientBase, createTool } from "@goat-sdk/core";

// Since we are creating a chain-agnostic plugin, we can use the WalletClientBase interface
export class MyPlugin extends PluginBase<WalletClientBase> {
    constructor() {
        // We define the name of the plugin
        super("myPlugin", []);
    }

    // We define the chain support for the plugin, in this case we support all chains
    supportsChain = (chain: Chain) => true;

    getTools(walletClient: WalletClientBase) {
        return [
            // Create tool requires two arguments:
            // 1. The tool metadata (name, description, parameters)
            // 2. The tool method (the function that will be executed when the tool is used)
            createTool(
                {
                    name: "sign_message",
                    description: "Sign a message",
                    parameters: z.object({
                        message: z.string(),
                    }),
                },
                async (parameters) => {
                    const signed = await walletClient.signMessage(parameters.message);
                    return signed.signedMessage;
                },
            ),
        ];
    }
}

// We export a factory function to create a new instance of the plugin
export const myPlugin = () => new MyPlugin();
```

### 3. Add the plugin to the agent

```typescript
import { getOnChainTools } from '@goat-sdk/adapter-vercel-ai';
import { myPlugin } from './your-plugin-path/signMessagePlugin'; // Path to your plugin

const wallet = /* Initialize your wallet client */;

const tools = getOnChainTools({
    wallet: viem(wallet), // or smartwallet(wallet), solana(wallet), etc.
    plugins: [
        myPlugin(),
        // ...other plugins
    ],
});

// Prompt: Sign the message "Sign the message 'Go out and eat grass 🐐'"
```

### Next steps
- Share your plugin with others!
- Open a PR to add it to the [plugins registry](https://github.com/goat-sdk/goat/tree/main/typescript/packages/plugins) in the [GOAT SDK](https://github.com/goat-sdk/goat).
