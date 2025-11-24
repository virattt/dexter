export interface ClaimResultProps {
    campaignId: string;
    detail: string;
    amount?: string;
    transactionHash?: string;
    chainId?: number;
    nameToken?: string;
    decimals?: number;
}

export interface MerklRewardResponse {
    chain: {
        id: number;
    };
    rewards: Array<RewardMetadata>;
}

export interface TokenInfo {
    address: string;
    nameToken: string;
    decimals: number;
}

export interface TokenMetadata {
    address: string;
    symbol: string;
    decimals: number;
}

export interface RewardMetadata {
    token: TokenMetadata;
    amount: string;
    proofs: string[];
    claimed: string;
}
