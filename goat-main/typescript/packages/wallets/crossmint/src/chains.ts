import type { Chain as GoatChain } from "@goat-sdk/core";
import {
    type Chain,
    arbitrum,
    arbitrumSepolia,
    astarZkEVM,
    astarZkyoto,
    avalanche,
    avalancheFuji,
    base,
    baseSepolia,
    bsc,
    chiliz,
    mainnet,
    mode,
    modeTestnet,
    optimism,
    optimismSepolia,
    polygon,
    polygonAmoy,
    sepolia,
    shape,
    shapeSepolia,
    skaleNebula,
    skaleNebulaTestnet,
    story,
    storyTestnet,
    victionTestnet,
    xai,
    xaiTestnet,
    zora,
    zoraSepolia,
} from "viem/chains";

const faucetChains = [
    "arbitrum-sepolia",
    "avalanche-fuji",
    "base-sepolia",
    "ethereum-sepolia",
    "optimism-sepolia",
    "polygon-amoy",
    "skale-nebula-testnet",
    "viction-testnet",
] as const;

type SupportedFaucetChains = (typeof faucetChains)[number];

const smartWalletChains = [
    "polygon",
    "polygon-amoy",
    "base",
    "base-sepolia",
    "arbitrum",
    "arbitrum-sepolia",
    "mode",
    "mode-sepolia",
    "optimism",
    "optimism-sepolia",
    "story-mainnet",
    "story-testnet",
] as const;

export type SupportedSmartWalletChains = (typeof smartWalletChains)[number];

export const mintingChains = [
    "arbitrum",
    "arbitrum-sepolia",
    "astar-zkevm",
    "avalanche",
    "avalanche-fuji",
    "base",
    "base-sepolia",
    "bsc",
    "chiliz",
    "chiliz-spicy-testnet",
    "ethereum",
    "ethereum-sepolia",
    "mode",
    "mode-sepolia",
    "optimism",
    "optimism-sepolia",
    "polygon",
    "polygon-amoy",
    "shape",
    "shape-sepolia",
    "skale-nebula",
    "skale-nebula-testnet",
    "story-mainnet",
    "story-testnet",
    "soneium-minato-testnet",
    "xai",
    "xai-sepolia-testnet",
    "zkyoto",
    "zora",
    "zora-sepolia",
] as const;

export type SupportedMintingChains = (typeof mintingChains)[number];

export function isStoryChain(chain: string): boolean {
    return chain === "story-mainnet" || chain === "story-testnet";
}

const chainMap: Record<SupportedFaucetChains | SupportedSmartWalletChains | SupportedMintingChains, Chain> = {
    arbitrum,
    "arbitrum-sepolia": arbitrumSepolia,
    "astar-zkevm": astarZkEVM,
    avalanche,
    "avalanche-fuji": avalancheFuji,
    base,
    "base-sepolia": baseSepolia,
    bsc,
    chiliz,
    ethereum: mainnet,
    optimism,
    mode,
    "mode-sepolia": modeTestnet,
    "optimism-sepolia": optimismSepolia,
    polygon,
    "polygon-amoy": polygonAmoy,
    "ethereum-sepolia": sepolia,
    shape,
    "shape-sepolia": shapeSepolia,
    "skale-nebula": skaleNebula,
    "skale-nebula-testnet": skaleNebulaTestnet,
    "story-mainnet": story,
    "story-testnet": storyTestnet,
    "viction-testnet": victionTestnet,
    xai,
    "xai-sepolia-testnet": xaiTestnet,
    zkyoto: astarZkyoto,
    zora,
    "zora-sepolia": zoraSepolia,
    "chiliz-spicy-testnet": {
        id: 88882,
    } as Chain,
    "soneium-minato-testnet": {
        id: 88882,
    } as Chain,
};

export function getViemChain(chain: SupportedSmartWalletChains | SupportedFaucetChains): Chain {
    const viemChain = chainMap[chain];
    if (!viemChain) {
        throw new Error(`Unsupported chain: ${chain}`);
    }
    return viemChain;
}

export function getCrossmintChainString(chain: GoatChain): string {
    if (chain.type === "solana") {
        return "solana";
    }
    if (chain.type === "aptos") {
        return "aptos";
    }

    if (chain.type === "evm") {
        // from chain.id figure out the chain name
        const chainName = Object.keys(chainMap).find(
            (key): key is keyof typeof chainMap => chainMap[key as keyof typeof chainMap].id === chain.id,
        );
        if (!chainName) {
            throw new Error(`Unsupported chain: ${chain.id}`);
        }
        return chainName;
    }

    throw new Error(`Unsupported chain: ${chain.type}`);
}

const testnetChains = ["arbitrum-sepolia", "base-sepolia", "optimism-sepolia", "polygon-amoy"] as const;

const faucetChainIds = new Set(faucetChains.map((chainName) => chainMap[chainName].id));

export function isChainSupportedByFaucet(chainId: number): boolean {
    return faucetChainIds.has(chainId);
}

const mintingChainIds = new Set(mintingChains.map((chainName) => chainMap[chainName].id));

export function isChainSupportedByMinting(chainId: number): boolean {
    return mintingChainIds.has(chainId);
}

export function getTestnetChainNameById(chainId: number): string | null {
    const testnetChainIdMap: Record<number, string> = {
        421614: "arbitrum-sepolia",
        84532: "base-sepolia",
        11155111: "ethereum-sepolia",
        11155420: "optimism-sepolia",
        999999999: "zora-sepolia",
        919: "mode-sepolia",
    };

    return testnetChainIdMap[chainId] || null;
}
