# How to add a wallet provider
If you don't see your wallet provider supported, you can easily integrate it by implementing the specific [WalletClient](https://github.com/goat-sdk/goat/blob/main/typescript/packages/core/src/wallets/core.ts) interface for the chain and type of wallet you want to support:

1. [EVMWalletClient](https://github.com/goat-sdk/goat/blob/main/typescript/packages/core/src/wallets/evm.ts) for all EVM chains
2. [EVMSmartWalletClient](https://github.com/goat-sdk/goat/blob/main/typescript/packages/core/src/wallets/evm-smart-wallet.ts) for EVM smart wallets
2. [SolanaWalletClient](https://github.com/goat-sdk/goat/blob/main/typescript/packages/core/src/wallets/solana.ts) for Solana

Checkout [here how the viem client implementation](https://github.com/goat-sdk/goat/blob/main/typescript/packages/wallets/viem/src/index.ts).

If you would like to see your wallet provider supported, please open an issue or submit a PR.
