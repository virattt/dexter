import { LitActionResource, LitPKPResource } from "@lit-protocol/auth-helpers";
import { LIT_ABILITY, type LIT_NETWORK, LIT_RPC } from "@lit-protocol/constants";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { EthWalletProvider } from "@lit-protocol/lit-auth-client";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import type { AuthSig, MintCapacityCreditsRes, SessionSigsMap } from "@lit-protocol/types";
import { type GeneratePrivateKeyResult, type StoredKeyData, api } from "@lit-protocol/wrapped-keys";
import { ethers } from "ethers";

const { generatePrivateKey, getEncryptedKey } = api;

export type LIT_NETWORKS_KEYS = (typeof LIT_NETWORK)[keyof typeof LIT_NETWORK];

/**
 * Creates and initializes a new Lit Protocol node client
 * @param network - The Lit Network to connect to (e.g., 'datil', 'datil-test', 'datil')
 * @param debug - Optional flag to enable debug logging (default: false)
 * @returns Promise resolving to a connected LitNodeClient instance
 * @throws Error if connection fails
 */
export async function createLitNodeClient(network: LIT_NETWORKS_KEYS, debug = false): Promise<LitNodeClient> {
    const litNodeClient = new LitNodeClient({
        litNetwork: network,
        debug,
    });
    await litNodeClient.connect();
    return litNodeClient;
}

/**
 * Creates and connects a Lit Contracts client for interacting with Lit Protocol smart contracts
 * @param ethersWallet - Initialized Ethers wallet instance for signing transactions
 * @param network - The Lit Network to connect to (e.g., 'datil', 'datil-test', 'datil')
 * @returns Promise resolving to a connected LitContracts instance
 * @throws Error if connection fails
 */
export async function createLitContractsClient(
    ethersWallet: ethers.Wallet,
    network: LIT_NETWORKS_KEYS,
): Promise<LitContracts> {
    const litContractClient = new LitContracts({
        signer: ethersWallet,
        network,
    });
    await litContractClient.connect();
    return litContractClient;
}

/**
 * Creates an Ethers wallet instance configured for Lit Protocol
 * @param privateKey - Private key for the wallet (with 0x prefix)
 * @returns Configured Ethers wallet instance connected to Lit RPC
 */
export function createEthersWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE));
}

/**
 * Mints a new capacity credit NFT for rate limiting
 * @param litContractClient - Connected LitContracts instance
 * @param requestsPerSecond - Number of requests per second allowed
 * @param daysUntilUTCMidnightExpiration - Number of days until the credit expires at UTC midnight (max is 30 days)
 * @returns Promise resolving to minting transaction result with capacity token details
 * @throws Error if minting fails
 */
export async function mintCapacityCredit(
    litContractClient: LitContracts,
    requestsPerSecond: number,
    daysUntilUTCMidnightExpiration: number,
): Promise<MintCapacityCreditsRes> {
    return litContractClient.mintCapacityCreditsNFT({
        requestsPerSecond: requestsPerSecond,
        daysUntilUTCMidnightExpiration: daysUntilUTCMidnightExpiration,
    });
}

/**
 * Creates an authentication signature for capacity credit delegation
 * @param litNodeClient - Connected LitNodeClient instance
 * @param ethersWallet - Initialized Ethers wallet instance for signing transactions
 * @param capacityTokenId - ID of the capacity credit token to delegate
 * @param pkpEthAddress - Ethereum address of the PKP to delegate to
 * @returns Promise resolving to AuthSig for delegation
 * @throws Error if signature creation fails
 */
export async function createCapacityCreditDelegationAuthSig(
    litNodeClient: LitNodeClient,
    ethersWallet: ethers.Wallet,
    capacityTokenId: string,
    pkpEthAddress: string,
): Promise<AuthSig> {
    const { capacityDelegationAuthSig } = await litNodeClient.createCapacityDelegationAuthSig({
        dAppOwnerWallet: ethersWallet,
        capacityTokenId,
        delegateeAddresses: [pkpEthAddress],
        uses: "2",
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
    });

    return capacityDelegationAuthSig;
}

/**
 * Mints a new Programmable Key Pair (PKP) NFT
 * @param litContractClient - Connected LitContracts instance
 * @returns Promise resolving to PKP details including tokenId, publicKey, and ethAddress
 * @throws Error if minting fails
 */
export async function mintPKP(litContractClient: LitContracts): Promise<{
    tokenId: string;
    publicKey: string;
    ethAddress: string;
}> {
    return (await litContractClient.pkpNftContractUtils.write.mint()).pkp;
}

/**
 * Obtains session signatures for PKP authentication and capabilities
 * @param litNodeClient - Connected LitNodeClient instance
 * @param pkpPublicKey - Public key of the PKP
 * @param pkpEthAddress - Ethereum address of the PKP
 * @param ethersWallet - Initialized Ethers wallet instance for signing transactions
 * @param capacityTokenId - ID of the capacity credit token
 * @returns Promise resolving to session signatures
 * @throws Error if signature generation fails
 */
export async function getPKPSessionSigs(
    litNodeClient: LitNodeClient,
    pkpPublicKey: string,
    pkpEthAddress: string,
    ethersWallet: ethers.Wallet,
    capacityTokenId: string,
): Promise<SessionSigsMap> {
    return litNodeClient.getPkpSessionSigs({
        pkpPublicKey,
        capabilityAuthSigs: [
            await createCapacityCreditDelegationAuthSig(litNodeClient, ethersWallet, capacityTokenId, pkpEthAddress),
        ],
        authMethods: [
            await EthWalletProvider.authenticate({
                signer: ethersWallet,
                litNodeClient,
                expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
            }),
        ],
        resourceAbilityRequests: [
            {
                resource: new LitPKPResource("*"),
                ability: LIT_ABILITY.PKPSigning,
            },
            {
                resource: new LitActionResource("*"),
                ability: LIT_ABILITY.LitActionExecution,
            },
        ],
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
    });
}

/**
 * Generates a new wrapped key for secure key management
 * @param litNodeClient - Connected LitNodeClient instance
 * @param pkpSessionSigs - Valid session signatures for the PKP
 * @param network - Target network ('evm' or 'solana')
 * @param memo - Optional memo to attach to the wrapped key
 * @returns Promise resolving to wrapped key generation result
 * @throws Error if key generation fails
 */
export async function generateWrappedKey(
    litNodeClient: LitNodeClient,
    pkpSessionSigs: SessionSigsMap,
    network: "evm" | "solana",
    memo?: string,
): Promise<GeneratePrivateKeyResult> {
    return generatePrivateKey({
        litNodeClient,
        pkpSessionSigs,
        network,
        memo: memo ?? "This is a wrapped key generated by the Lit Goat Wallet Client",
    });
}

/**
 * Retrieves metadata for a wrapped key with Ethereum address
 * @param litNodeClient - Connected LitNodeClient instance
 * @param pkpSessionSigs - Valid session signatures for the PKP
 * @param wrappedKeyId - ID of the wrapped key to retrieve
 * @returns Promise resolving to wrapped key metadata with normalized Ethereum address
 * @throws Error if metadata retrieval fails
 */
export async function getWrappedKeyMetadata(
    litNodeClient: LitNodeClient,
    pkpSessionSigs: SessionSigsMap,
    wrappedKeyId: string,
): Promise<StoredKeyData & { wrappedKeyAddress: string }> {
    const keyMetadata = await getEncryptedKey({
        litNodeClient,
        pkpSessionSigs,
        id: wrappedKeyId,
    });

    return {
        ...keyMetadata,
        wrappedKeyAddress: ethers.utils.computeAddress(keyMetadata.publicKey),
    };
}
