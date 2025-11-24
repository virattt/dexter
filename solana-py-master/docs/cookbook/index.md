# Cookbook

The [`Solana Cookbook`](https://solana.com/zh/developers/cookbook) is a developer resource that provides examples and references for building applications on Solana. Each example and reference will focus on specific aspects of Solana development while providing additional details and usage examples.

## Development Guides

Development guides help developers set up and interact with the Solana ecosystem using various tools and clients.

| Guide                                                              | Client | Description                                             |
| ------------------------------------------------------------------ | ------ | ------------------------------------------------------- |
| [Connecting to Solana](development-guides/connecting-to-solana.md) | Python | How to connect to Solana clusters and verify connection |
| [Getting Test SOL](development-guides/getting-test-sol.md)                                                   | Python | How to get test SOL for development                     |
| [Subscribing to Events](development-guides/subscribing-to-events.md)                                              | Python | How to subscribe to account and program events          |
| [Create Account](development-guides/create-account.md)                                                     | Python | How to create a new account on Solana                   |

## Account Management

Learn how to manage Solana accounts effectively.

| Guide                                                                                    | Client | Description                                  |
| ---------------------------------------------------------------------------------------- | ------ | -------------------------------------------- |
| [Calculate Account Creation Cost](account-management/calculate-account-creation-cost.md) | Python | Calculate minimum balance for rent exemption |
| [Create PDA Account](account-management/create-pda-account.md)                                                                       | Python | Create Program Derived Address accounts      |
| [Get Account Balance](account-management/get-account-balance.md)                                                                      | Python | Retrieve account balance information         |

## Token Operations

Comprehensive guides for working with tokens on Solana.

| Guide                                            | Client | Description                              |
| ------------------------------------------------ | ------ | ---------------------------------------- |
| [Create Token](token-operations/create-token.md) | Python | Create a new SPL token                   |
| [Get Token Mint](token-operations/get-token-mint.md)                                   | Python | Retrieve token mint information          |
| [Create Token Account](token-operations/create-token-account.md)                             | Python | Create an associated token account       |
| [Get Token Account](token-operations/get-token-account.md)                                | Python | Retrieve token account information       |
| [Get Token Balance](token-operations/get-token-balance.md)                                | Python | Check token balance in an account        |
| [Mint Tokens](token-operations/mint-tokens.md)                                      | Python | Mint tokens to an account                |
| [Burn Tokens](token-operations/burn-tokens.md)                                      | Python | Burn tokens from an account              |
| [Transfer Tokens](token-operations/transfer-tokens.md)                                  | Python | Transfer tokens between accounts         |
| [Close Token Account](token-operations/close-token-account.md)                              | Python | Close and reclaim SOL from token account |
| [Get All Token Accounts](token-operations/get-all-token-accounts-by-owner.md)                           | Python | Get all token accounts by owner          |
| [Set Authority](token-operations/set-authority.md)                                    | Python | Change token mint or account authority   |
| [Delegate Token Account](token-operations/delegate-token-account.md)                           | Python | Delegate token account authority         |
| [Revoke Delegate](token-operations/revoke-delegate.md)                                  | Python | Revoke delegated authority               |
| [Wrapped SOL](token-operations/wrapped-sol.md)                                      | Python | Work with wrapped SOL tokens             |

## Transaction Operations

Explore various transaction-related operations on the Solana blockchain.

| Guide                      | Client | Description                             |
| -------------------------- | ------ | --------------------------------------- |
| [Send SOL](transaction-operations/send-sol.md)                   | Python | Send SOL between accounts               |
| [Send Tokens](transaction-operations/send-tokens.md)                | Python | Send tokens between accounts            |
| [Calculate Transaction Cost](transaction-operations/calculate-transaction-cost.md) | Python | Calculate transaction fees              |
| [Add Memo to Transaction](transaction-operations/add-memo-to-transaction.md)    | Python | Add memo instruction to transactions    |
| [Add Priority Fees](transaction-operations/add-priority-fees.md)          | Python | Add priority fees to transactions       |
| [Optimize Compute Requested](transaction-operations/optimize-compute-requested.md) | Python | Optimize compute units for transactions |
| [Offline Transactions](transaction-operations/offline-transactions.md)       | Python | Create and sign transactions offline    |

## Wallet Management

Learn how to create, restore, and manage Solana wallets using various tools and libraries.

| Guide                   | Client | Description                      |
| ----------------------- | ------ | -------------------------------- |
| [Create Keypair](wallet-management/create-keypair.md)          | Python | Generate new keypairs            |
| [Restore Keypair](wallet-management/restore-keypair.md)         | Python | Restore keypair from seed phrase |
| [Verify Keypair](wallet-management/verify-keypair.md)          | Python | Verify keypair validity          |
| [Validate Public Key](wallet-management/validate-public-key.md)     | Python | Validate public key format       |
| [Sign and Verify Message](wallet-management/sign-verify-message.md) | Python | Sign and verify messages         |

## Codebase

[Solana Cookbook Examples](https://github.com/Solana-ZH/solana-py-examples)
