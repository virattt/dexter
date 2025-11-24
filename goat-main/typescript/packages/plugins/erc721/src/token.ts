export type Token = {
    symbol: string;
    name: string;
    chains: Record<number, { contractAddress: `0x${string}` }>;
};

export type ChainSpecificToken = {
    chainId: number;
    symbol: string;
    name: string;
    contractAddress: `0x${string}`;
};

export const BAYC: Token = {
    symbol: "BAYC",
    name: "Bored Ape Yacht Club",
    chains: {
        "1": {
            contractAddress: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
        },
    },
};

export const CRYPTOPUNKS: Token = {
    symbol: "PUNK",
    name: "CryptoPunks",
    chains: {
        "1": {
            contractAddress: "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB",
        },
    },
};

export function getTokensForNetwork(chainId: number, tokens: Token[]): ChainSpecificToken[] {
    const result: ChainSpecificToken[] = [];

    for (const token of tokens) {
        const chainData = token.chains[chainId];
        if (chainData) {
            result.push({
                chainId: chainId,
                symbol: token.symbol,
                name: token.name,
                contractAddress: chainData.contractAddress,
            });
        }
    }

    return result;
}
