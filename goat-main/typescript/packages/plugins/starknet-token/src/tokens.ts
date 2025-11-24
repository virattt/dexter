export type StarknetNetwork = "mainnet" | "testnet" | "goerli";

export type Token = {
    decimals: number;
    symbol: string;
    name: string;
    addresses: Record<StarknetNetwork, string | null>;
};

export type NetworkSpecificToken = Omit<Token, "addresses"> & {
    network: StarknetNetwork;
    address: string;
};

export const ETH: Token = {
    decimals: 18,
    symbol: "ETH",
    name: "Ether",
    addresses: {
        mainnet: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        testnet: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        goerli: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    },
};

export const USDC: Token = {
    decimals: 6,
    symbol: "USDC",
    name: "USD Coin",
    addresses: {
        mainnet: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
        testnet: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
        goerli: null,
    },
};

export const STARK: Token = {
    decimals: 18,
    symbol: "STRK",
    name: "Starknet Token",
    addresses: {
        mainnet: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        testnet: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        goerli: null,
    },
};

export const EKUBO: Token = {
    decimals: 18,
    symbol: "EKUBO",
    name: "Ekubo",
    addresses: {
        mainnet: "0x075afe6402aD5A5c20Dd25E10eC3b3986aCAA647b77e4Ae24B0CBc9a54A27a87",
        testnet: null,
        goerli: null,
    },
};

export const STARKNET_TOKENS: Token[] = [ETH, USDC, STARK, EKUBO];

export function getTokensForNetwork(network: StarknetNetwork, tokens: Token[]): NetworkSpecificToken[] {
    const result: NetworkSpecificToken[] = [];

    for (const token of tokens) {
        const address = token.addresses[network];
        if (address) {
            result.push({
                network,
                decimals: token.decimals,
                symbol: token.symbol,
                name: token.name,
                address,
            });
        }
    }

    return result;
}
