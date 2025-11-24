<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

<!-- omit in toc -->
# Lit Protocol Wallets for GOAT

A GOAT wallet client implementation for Lit Protocol, supporting both EVM and Solana chains.

<!-- omit in toc -->
## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Chain Support](#chain-support)
  - [EVM](#evm)
  - [Solana](#solana)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Lit EVM Wallet Client](#lit-evm-wallet-client)
  - [Lit Solana Wallet Client](#lit-solana-wallet-client)
- [API Reference](#api-reference)
  - [Setup Functions](#setup-functions)
    - [createLitNodeClient](#createlitnodeclient)
    - [createLitContractsClient](#createlitcontractsclient)
    - [createEthersWallet](#createetherswallet)
    - [mintCapacityCredit](#mintcapacitycredit)
    - [createCapacityCreditDelegationAuthSig](#createcapacitycreditdelegationauthsig)
    - [mintPKP](#mintpkp)
    - [getPKPSessionSigs](#getpkpsessionsigs)
    - [generateWrappedKey](#generatewrappedkey)
    - [getWrappedKeyMetadata](#getwrappedkeymetadata)
  - [Wallet Client Creation](#wallet-client-creation)
    - [LitEVMWalletClient](#litevmwalletclient)
    - [LitSolWalletClient](#litsolwalletclient)

## Features

- 🔐 Secure key management leveraging Lit Protocol's [Wrapped Keys](https://developer.litprotocol.com/user-wallets/wrapped-keys/overview)
  - The private key the Agent uses to sign is only ever exposed in clear text within the Lit node's [Trusted Execution Environment (TEE)](https://developer.litprotocol.com/resources/how-it-works)
- ⛓️ Multi-chain support (EVM and Solana)
  - Can be extended to support additional chains and signing capabilities by implementing custom [Lit Actions](https://developer.litprotocol.com/sdk/serverless-signing/overview)
- 📝 Session-based authentication
  - The wallet client can be extended with additional authentication capabilities such as Google and Discord OAuth, Passkeys, and more

## Installation

```bash
npm install @goat-sdk/wallet-lit
yarn add @goat-sdk/wallet-lit
pnpm add @goat-sdk/wallet-lit
```

## Chain Support

### EVM

An example of how to use the Lit EVM wallet client can be found [here](../../../examples/langchain/lit/src/evm.ts).

- Support for many EVM-compatible chains
  - Go [here](https://developer.litprotocol.com/resources/supported-chains#access-control-conditions) for a list of supported chains
- Transaction signing and sending
- Message signing (EIP-191 and EIP-712)
- Contract interactions

### Solana

An example of how to use the Lit Solana wallet client can be found [here](../../../examples/langchain/lit/src/sol.ts).

- Transaction signing and sending
- Message signing
- Contract interactions

## Quick Start

### Prerequisites

- The corresponding wallet for `process.env.WALLET_PRIVATE_KEY` must have Lit test tokens in order to mint a PKP and capacity credit
  - You can get test tokens from the [Lit Testnet Faucet](https://chronicle-yellowstone-faucet.getlit.dev/)

### Lit EVM Wallet Client

```typescript
import { 
    createLitNodeClient,
    createEthersWallet,
    createLitContractsClient,
    mintCapacityCredit,
    mintPKP,
    getPKPSessionSigs,
    generateWrappedKey,
    lit 
} from "@goat-sdk/wallet-lit";
import { LIT_NETWORK } from "@lit-protocol/constants";
import { clusterApiUrl, Connection } from "@solana/web3.js";

// Initialize Lit components
const litNodeClient = await createLitNodeClient(LIT_NETWORK.DatilTest);
const ethersWallet = createEthersWallet(process.env.WALLET_PRIVATE_KEY);
const litContractsClient = await createLitContractsClient(ethersWallet, LIT_NETWORK.DatilTest);

// Mint capacity credit and PKP
const capacityCredit = await mintCapacityCredit(
    litContractsClient, 
    10, // requests per second
    30 // days until expiration
);
const pkp = await mintPKP(litContractsClient);

// Get session signatures
const pkpSessionSigs = await getPKPSessionSigs(
    litNodeClient,
    pkp.publicKey,
    pkp.ethAddress,
    ethersWallet,
    capacityCredit.capacityTokenId
);

// Generate wrapped key and get metadata
const wrappedKey = await generateWrappedKey(litNodeClient, pkpSessionSigs, "evm");
const wrappedKeyMetadata = await getWrappedKeyMetadata(litNodeClient, pkpSessionSigs, wrappedKey.id);

// Create viem wallet client
const viemWalletClient = createWalletClient({
    transport: http(process.env.RPC_URL),
    chain: sepolia,
});

// Initialize Lit wallet client
const litWallet = lit({
    litNodeClient,
    pkpSessionSigs,
    wrappedKeyMetadata,
    network: "evm",
    chainId: 11155111,
    litEVMChainIdentifier: 'sepolia',
    viemWalletClient,
});
```

### Lit Solana Wallet Client

```typescript
import { 
    createLitNodeClient,
    createEthersWallet,
    createLitContractsClient,
    mintCapacityCredit,
    mintPKP,
    getPKPSessionSigs,
    generateWrappedKey,
    lit 
} from "@goat-sdk/wallet-lit";
import { LIT_NETWORK } from "@lit-protocol/constants";
import { createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";

// Initialize Lit components
const litNodeClient = await createLitNodeClient(LIT_NETWORK.DatilTest);
const ethersWallet = createEthersWallet(process.env.WALLET_PRIVATE_KEY);
const litContractsClient = await createLitContractsClient(ethersWallet, LIT_NETWORK.DatilTest);

// Mint capacity credit and PKP
const capacityCredit = await mintCapacityCredit(
    litContractsClient, 
    10, // requests per second
    30 // days until expiration
);
const pkp = await mintPKP(litContractsClient);

// Get session signatures
const pkpSessionSigs = await getPKPSessionSigs(
    litNodeClient,
    pkp.publicKey,
    pkp.ethAddress,
    ethersWallet,
    capacityCredit.capacityTokenId
);

// Generate wrapped key and get metadata
const wrappedKey = await generateWrappedKey(litNodeClient, pkpSessionSigs, "evm");
const wrappedKeyMetadata = await getWrappedKeyMetadata(litNodeClient, pkpSessionSigs, wrappedKey.id);

// Create Solana connection
const connection = new Connection(
    clusterApiUrl("devnet"),
    "confirmed"
);

// Initialize Lit wallet client
const litWallet = lit({
    litNodeClient,
    pkpSessionSigs,
    wrappedKeyMetadata,
    network: "solana",
    connection,
    chain: "devnet",
});
```

## API Reference

### Setup Functions

#### createLitNodeClient

```typescript
/**
 * Creates and initializes a new Lit Protocol node client
 * @param network - The Lit Network to connect to (e.g., 'datil', 'datil-test', 'datil')
 * @param debug - Optional flag to enable debug logging (default: false)
 * @returns Promise resolving to a connected LitNodeClient instance
 * @throws Error if connection fails
 */
async function createLitNodeClient(network: LIT_NETWORKS_KEYS, debug?: boolean): Promise<LitNodeClient>
```

#### createLitContractsClient

```typescript
/**
 * Creates and connects a Lit Contracts client for interacting with Lit Protocol smart contracts
 * @param ethersWallet - Initialized Ethers wallet instance for signing transactions
 * @param network - The Lit Network to connect to (e.g., 'datil', 'datil-test', 'datil')
 * @returns Promise resolving to a connected LitContracts instance
 * @throws Error if connection fails
 */
async function createLitContractsClient(ethersWallet: ethers.Wallet, network: LIT_NETWORKS_KEYS): Promise<LitContracts>
```

#### createEthersWallet

```typescript
/**
 * Creates an ethers Wallet instance configured for Lit Protocol
 * @param privateKey - Private key for the wallet (with 0x prefix)
 * @returns Configured ethers Wallet instance connected to Lit RPC
 */
function createEthersWallet(privateKey: string): ethers.Wallet
```

#### mintCapacityCredit

```typescript
/**
 * Mints a new capacity credit NFT for rate limiting
 * @param litContractClient - Connected LitContracts instance
 * @param requestsPerSecond - Number of requests per second allowed
 * @param daysUntilUTCMidnightExpiration - Number of days until the credit expires at UTC midnight (max is 30 days)
 * @returns Promise resolving to minting transaction result with capacity token details
 * @throws Error if minting fails
 */
async function mintCapacityCredit(
    litContractClient: LitContracts,
    requestsPerSecond: number,
    daysUntilUTCMidnightExpiration: number
): Promise<MintCapacityCreditsRes>
```

#### createCapacityCreditDelegationAuthSig

```typescript
/**
 * Creates an authentication signature for capacity credit delegation
 * @param litNodeClient - Connected LitNodeClient instance
 * @param ethersWallet - Initialized Ethers wallet instance for signing transactions
 * @param capacityTokenId - ID of the capacity credit token to delegate
 * @param pkpEthAddress - Ethereum address of the PKP to delegate to
 * @returns Promise resolving to AuthSig for delegation
 * @throws Error if signature creation fails
 */
async function createCapacityCreditDelegationAuthSig(
    litNodeClient: LitNodeClient,
    ethersWallet: ethers.Wallet,
    capacityTokenId: string,
    pkpEthAddress: string
): Promise<AuthSig>
```

#### mintPKP

```typescript
/**
 * Mints a new Programmable Key Pair (PKP) NFT
 * @param litContractClient - Connected LitContracts instance
 * @returns Promise resolving to PKP details including tokenId, publicKey, and ethAddress
 * @throws Error if minting fails
 */
async function mintPKP(litContractClient: LitContracts): Promise<{
    tokenId: string;
    publicKey: string;
    ethAddress: string;
}>
```

#### getPKPSessionSigs

```typescript
/**
 * Obtains session signatures for PKP authentication and capabilities
 * @param litNodeClient - Connected LitNodeClient instance
 * @param pkpPublicKey - Public key of the PKP
 * @param pkpEthAddress - Ethereum address of the PKP
 * @param ethersWallet - Wallet instance for signing
 * @param capacityTokenId - ID of the capacity credit token
 * @returns Promise resolving to session signatures map for various capabilities
 * @throws Error if signature generation fails
 */
async function getPKPSessionSigs(
    litNodeClient: LitNodeClient,
    pkpPublicKey: string,
    pkpEthAddress: string,
    ethersWallet: ethers.Wallet,
    capacityTokenId: string
): Promise<SessionSigsMap>
```

#### generateWrappedKey

```typescript
/**
 * Generates a new wrapped key for secure key management
 * @param litNodeClient - Connected LitNodeClient instance
 * @param pkpSessionSigs - Valid session signatures for the PKP
 * @param network - Target network ('evm' or 'solana')
 * @param memo - Optional memo to attach to the wrapped key
 * @returns Promise resolving to wrapped key generation result
 * @throws Error if key generation fails
 */
async function generateWrappedKey(
    litNodeClient: LitNodeClient,
    pkpSessionSigs: SessionSigsMap,
    network: "evm" | "solana",
    memo?: string
): Promise<GeneratePrivateKeyResult>
```

#### getWrappedKeyMetadata

```typescript
/**
 * Retrieves metadata for a wrapped key with Ethereum address
 * @param litNodeClient - Connected LitNodeClient instance
 * @param pkpSessionSigs - Valid session signatures for the PKP
 * @param wrappedKeyId - ID of the wrapped key to retrieve
 * @returns Promise resolving to wrapped key metadata with normalized Ethereum address
 * @throws Error if metadata retrieval fails
 */
async function getWrappedKeyMetadata(
    litNodeClient: LitNodeClient,
    pkpSessionSigs: SessionSigsMap,
    wrappedKeyId: string
): Promise<StoredKeyData & { ethAddress: `0x${string}` }>
```

### Wallet Client Creation

#### LitEVMWalletClient

You can create a Lit EVM wallet client by passing the following options to the `lit` function:

```typescript
import type { StoredKeyData } from "@lit-protocol/wrapped-keys";

type LitEVMWalletOptions = {
    litNodeClient: LitNodeClient;
    pkpSessionSigs: SessionSigsMap;
    wrappedKeyMetadata: StoredKeyData & { wrappedKeyAddress: string };
    network: "evm";
    chainId: number;
    litEVMChainIdentifier: string;
    viemWalletClient: WalletClient;
};

const litWallet = lit(options: LitEVMWalletOptions);
```

#### LitSolWalletClient

You can create a Lit Solana wallet client by passing the following options to the `lit` function:

```typescript
import type { StoredKeyData } from "@lit-protocol/wrapped-keys";

type LitSolanaWalletOptions = {
    litNodeClient: LitNodeClient;
    pkpSessionSigs: SessionSigsMap;
    wrappedKeyMetadata: StoredKeyData & { wrappedKeyAddress: string };
    network: "solana";
    connection: Connection;
    chain: "devnet" | "mainnet-beta" | "testnet";
};

const litWallet = lit(options: LitSolanaWalletOptions);
```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>