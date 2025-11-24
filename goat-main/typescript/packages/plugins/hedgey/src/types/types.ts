export interface ClaimHedgeyRewardsResponse {
    campaignId: string;
    detail: string;
    amount?: string;
    transactionHash?: string;
    chain?: number;
    tokenName?: string;
}

export interface HedgeyProofResponse {
    canClaim: boolean;
    amount: string;
    proof: string[];
}

export interface NewsEntryProps {
    fields: {
        link?: {
            "en-US"?: string;
        };
    };
}

export interface CampaignInfo {
    campaignStatus: string;
    campaign: {
        token: {
            ticker: string;
        };
    };
}

export interface ActiveCampaign {
    campaignId: string;
    tokenName: string;
}

export interface ProofResult {
    campaignId: string;
    data: HedgeyProofResponse | null;
    error: unknown;
}

export interface ClaimableCampaign {
    campaignId: string;
    claimAmount: string;
    proof: string[];
    tokenName: string;
}

export interface HedgeyClaimsResponse {
    data?: {
        TokenCampaignEvents?: {
            events?: Array<{ campaignId?: string }>;
        };
    };
}
