export const chainNameToId: { [key: string]: number } = {
    ethereum: 1,
    polygon: 137,
    optimism: 10,
    arbitrum: 42161,
    mantle: 5000,
    base: 8453,
    avalanche: 43114,
    binance: 56,
    gnosis: 100,
    mode: 34443,
    scroll: 534352,
    // Add more chains as needed
};

export function getChainId(chainName: string): number {
    const normalizedName = chainName.toLowerCase().trim();
    const chainId = chainNameToId[normalizedName];

    if (!chainId) {
        throw new Error(`Unsupported chain name: ${chainName}. Please check the chain name and try again.`);
    }

    return chainId;
}
