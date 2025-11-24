# How to add a new chain

## 1. Add the chain to the `Chain.ts` file
Add your chain to the `Chain.ts` file in the [core package](https://github.com/goat-sdk/goat/tree/main/typescript/packages/core/src/types/Chain.ts).

```typescript
/**
 * @param type - "evm" or "solana", extend this union as needed (e.g., "sui")
 * @param id - Chain ID, optional for EVM
 */
export type Chain = EvmChain | SolanaChain | AptosChain | ChromiaChain | FuelChain | MyAwesomeChain;

export type MyAwesomeChain = {
    type: "my-awesome-chain";
};
```

## 2. Create a new wallet provider package
Create a new package in the [wallets directory](https://github.com/goat-sdk/goat/tree/main/typescript/packages/wallets) with the name of your chain (e.g. `my-awesome-chain`) or copy an existing one (e.g. `evm`).
In this package you will define the abstract class for your chain's wallet client which will extend the `WalletClientBase` class defined in the [core package](https://github.com/goat-sdk/goat/tree/main/typescript/packages/core/src/classes/WalletClientBase.ts).

WalletClientBase only includes the methods that are supported by all chains such as:
1. `getAddress`
2. `getChain`
3. `signMessage`
4. `balanceOf`

As well as includes the `getCoreTools` method which returns the core tools for the chain.

```typescript
export abstract class MyAwesomeChainWalletClient extends WalletClientBase {
    // Add your chain's methods here
    abstract getChain(): MyAwesomeChain;
    sendTransaction: (transaction: AwesomeChainTransaction) => Promise<Transaction>;
    read: (query: AwesomeChainQuery) => Promise<AwesomeChainResponse>;
}
```

## 3. Create a plugin to allow sending your native token to a wallet
Create a plugin to allow sending your native token to a wallet. Create a file in the same package as your wallet client and create a new file like `send<native-token>.plugin.ts`.

Implement the core plugin.


```typescript
export class SendAWESOMETOKENPlugin extends PluginBase<MyAwesomeChainWalletClient> {
    constructor() {
        super("sendAWESOMETOKEN", []);
    }

    supportsChain = (chain: Chain) => chain.type === "my-awesome-chain";

    getTools(walletClient: MyAwesomeChainWalletClient) {
        const sendTool = createTool(
            {
                name: `send_myawesometoken`,
                description: `Send MYAWESOMETOKEN to an address.`,
                parameters: sendAWESOMETOKENParametersSchema, // Define the parameters schema
            },
            // Implement the method
            (parameters: z.infer<typeof sendAWESOMETOKENParametersSchema>) => sendAWESOMETOKENMethod(walletClient, parameters),
        );
        return [sendTool];
    }
}
```

## 4. Implement the wallet client
Extend your abstract class with the methods you need to implement and create your first wallet client! (e.g `MyAwesomeChainKeyPairWalletClient`)

```typescript
export class MyAwesomeChainKeyPairWalletClient extends MyAwesomeChainWalletClient {
    // Implement the methods here
}

// Export the wallet client with a factory function
export const myAwesomeChain = () => new MyAwesomeChainKeyPairWalletClient();
```

## 5. Submit a PR
Submit a PR to add your wallet provider to the [wallets directory](https://github.com/goat-sdk/goat/tree/main/typescript/packages/wallets).
