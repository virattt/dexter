import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { CAMPAIGN_ABI, CAMPAIGN_ADDRESS } from "./abi/hedgey.abi";
import { API_CONFIG } from "./config/config";
import { getErrorMessage } from "./helpers/error.helper";
import { fetchJSON, postJSON, toBytes16 } from "./helpers/http.helper";
import { ClaimStakingRewardsParams } from "./parameters";
import {
    ActiveCampaign,
    CampaignInfo,
    ClaimHedgeyRewardsResponse,
    ClaimableCampaign,
    HedgeyClaimsResponse,
    HedgeyProofResponse,
    NewsEntryProps,
    ProofResult,
} from "./types/types";

const GET_CLAIMS_FOR_ADDRESS_QUERY = `
  query GetClaimsForAddress($input: TokenCampaignEventsResolverInput) {
    TokenCampaignEvents(input: $input) {
      events { campaignId }
    }
  }
`;

const NO_CLAIMABLE_MESSAGE = "No claimable tokens available";

export class HedgeyService {
    @Tool({
        name: "claim_hedgey_rewards",
        description: "Claim staking rewards and Hedgey tokens on Optimism",
    })
    async claimHedgeyRewards(
        walletClient: EVMWalletClient,
        parameters: ClaimStakingRewardsParams,
    ): Promise<ClaimHedgeyRewardsResponse[]> {
        const userAddress = walletClient.getAddress();
        const network = walletClient.getChain();
        if (!network?.id) {
            throw new Error("Unable to determine chain ID from wallet client");
        }
        try {
            const campaignIds = await this.fetchCampaignIds();

            if (parameters.campaignIds && parameters.campaignIds.length > 0) {
                campaignIds.push(...parameters.campaignIds);
            }

            const activeCampaigns = await this.filterActiveCampaigns(campaignIds, userAddress);
            if (activeCampaigns.length === 0) {
                return [{ campaignId: "", detail: NO_CLAIMABLE_MESSAGE }];
            }
            const proofPromises = activeCampaigns.map((campaign) =>
                this.fetchProofForCampaign(campaign.campaignId, userAddress),
            );
            const settledProofResults = await Promise.allSettled(proofPromises);

            const proofResults = settledProofResults.map((result) => {
                if (result.status === "fulfilled") {
                    return result.value;
                }
                let campaignId = "unknown";
                if (result.reason && typeof result.reason === "object" && "campaignId" in result.reason) {
                    campaignId = result.reason.campaignId;
                }
                return { campaignId, data: null, error: result.reason };
            });

            const { claimableCampaigns, results } = this.processProofResults(proofResults, activeCampaigns);

            if (claimableCampaigns.length > 0) {
                const { transactionHash } = await this.executeClaimTransaction(walletClient, claimableCampaigns);
                for (const claim of claimableCampaigns) {
                    results.push({
                        campaignId: claim.campaignId,
                        detail: "Claimed",
                        amount: claim.claimAmount,
                        transactionHash: transactionHash,
                        chain: network.id,
                        tokenName: claim.tokenName,
                    });
                }
            }

            if (results.length === 0) {
                return [{ campaignId: "", detail: NO_CLAIMABLE_MESSAGE, chain: network.id }];
            }

            return results;
        } catch (error) {
            return [{ campaignId: "", detail: `Failed to claim tokens: ${getErrorMessage(error)}`, chain: network.id }];
        }
    }

    private async filterActiveCampaigns(campaignIds: string[], userAddress: string): Promise<ActiveCampaign[]> {
        const campaignInfoPromises = campaignIds.map(async (campaignId) => {
            try {
                const url = `${API_CONFIG.HEDGEY_TOKEN_CLAIMS_INFO_URL}/${campaignId}`;
                const rawData = await fetchJSON(url);
                const info = rawData as CampaignInfo;
                const tokenName = info?.campaign?.token?.ticker ?? "";

                return { campaignId, tokenName, info };
            } catch (e) {
                return { campaignId, info: null, error: e };
            }
        });
        const campaignInfoResults = await Promise.all(campaignInfoPromises);

        const graphqlBody = {
            operationName: "GetClaimsForAddress",
            query: GET_CLAIMS_FOR_ADDRESS_QUERY,
            variables: { input: { eventType: "TokensClaimed", address: userAddress, includeTestnets: true } },
        };
        const rawData = await postJSON(API_CONFIG.HEDGEY_GRAPHQL_ENDPOINT, graphqlBody);
        const claimsData = rawData as HedgeyClaimsResponse;

        const claimedCampaignIds = new Set<string>();
        if (claimsData?.data?.TokenCampaignEvents?.events) {
            for (const event of claimsData.data.TokenCampaignEvents.events) {
                if (event.campaignId) {
                    claimedCampaignIds.add(event.campaignId);
                }
            }
        }
        const activeCampaigns: ActiveCampaign[] = [];
        for (const result of campaignInfoResults) {
            if (
                result.info &&
                (result.info as { campaignStatus: string }).campaignStatus === "active" &&
                !claimedCampaignIds.has(result.campaignId)
            ) {
                activeCampaigns.push({ campaignId: result.campaignId, tokenName: result.tokenName });
            }
        }
        return activeCampaigns;
    }

    private async fetchCampaignIds(): Promise<string[]> {
        const rawData = await fetchJSON(API_CONFIG.HEDGEY_CAMPAIGNS_URL);
        const newsArray = rawData as NewsEntryProps[];
        return newsArray
            .map((entry) => {
                const link = entry.fields.link?.["en-US"];
                return link ? link.split(API_CONFIG.HEDGEY_CLAIM_URL)[1] : undefined;
            })
            .filter((campaignId): campaignId is string => !!campaignId);
    }

    private async fetchProofForCampaign(campaignId: string, userAddress: string): Promise<ProofResult> {
        const proofUrl = `${API_CONFIG.HEDGEY_PROOF_URL}/${campaignId}/${userAddress}`;
        try {
            const data = await fetchJSON(proofUrl);
            return { campaignId, data: data as HedgeyProofResponse, error: null };
        } catch (error) {
            return { campaignId, data: null, error };
        }
    }

    private processProofResults(
        proofResults: ProofResult[],
        activeCampaigns: ActiveCampaign[],
    ): {
        claimableCampaigns: ClaimableCampaign[];
        results: ClaimHedgeyRewardsResponse[];
    } {
        const claimableCampaigns: ClaimableCampaign[] = [];
        const results: ClaimHedgeyRewardsResponse[] = [];
        for (const result of proofResults) {
            if (result.error) {
                results.push({
                    campaignId: result.campaignId,
                    detail: `Error: ${getErrorMessage(result.error)}`,
                });
            } else if (!result.data?.canClaim) {
                results.push({
                    campaignId: result.campaignId,
                    detail: NO_CLAIMABLE_MESSAGE,
                });
            } else {
                const campaignInfo = activeCampaigns.find((c) => c.campaignId === result.campaignId);
                claimableCampaigns.push({
                    campaignId: result.campaignId,
                    claimAmount: result.data.amount,
                    proof: result.data.proof,
                    tokenName: campaignInfo ? campaignInfo.tokenName : "$$",
                });
            }
        }
        return { claimableCampaigns, results };
    }

    private async executeClaimTransaction(
        walletClient: EVMWalletClient,
        claimableCampaigns: ClaimableCampaign[],
    ): Promise<{ transactionHash: string }> {
        const campaignIdsBytes16 = claimableCampaigns.map((claim) => toBytes16(claim.campaignId));
        const proofs = claimableCampaigns.map((claim) => claim.proof);
        const claimAmounts = claimableCampaigns.map((claim) => claim.claimAmount);
        try {
            const txResponse = await walletClient.sendTransaction({
                to: CAMPAIGN_ADDRESS as `0x${string}`,
                abi: CAMPAIGN_ABI,
                functionName: "claimMultiple",
                args: [campaignIdsBytes16, proofs, claimAmounts],
            });
            return { transactionHash: txResponse.hash };
        } catch (txError) {
            throw new Error(`Transaction failed: ${getErrorMessage(txError)}`);
        }
    }
}
