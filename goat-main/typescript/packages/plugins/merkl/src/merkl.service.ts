import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";

import { MERKL_CAMPAIGN_ABI, MERKL_CAMPAIGN_ADDRESS } from "./abi/merkl.abi";
import { fetchJson } from "./helpers/http.helper";
import { ClaimProtocolIncentivesParams } from "./parameters";
import { ClaimResultProps, MerklRewardResponse, RewardMetadata, TokenInfo } from "./types/types";

const MERKL_REVIEW_URL = "https://api.merkl.xyz/v4/users";

export class MerklService {
    @Tool({
        name: "claim_merkl_incentives",
        description: "Claim protocol incentives and Merkl rewards for a given address and chain",
    })
    async claimMerklRewards(
        walletClient: EVMWalletClient,
        parameters: ClaimProtocolIncentivesParams,
    ): Promise<ClaimResultProps[]> {
        try {
            const userAddress = walletClient.getAddress();
            const network = walletClient.getChain();
            if (!network?.id) {
                throw new Error("Unable to determine chain ID from wallet client");
            }
            const chainId = network.id;
            const rewardsUrl = `${MERKL_REVIEW_URL}/${userAddress}/rewards?chainId=${chainId}`;

            const rewardsData: MerklRewardResponse[] = await fetchJson(rewardsUrl);

            if (!rewardsData || rewardsData.length === 0) {
                return [{ campaignId: "", detail: "No rewards data found" }];
            }

            const { users, tokens, amounts, proofs } = this.extractRewardData(rewardsData, chainId, userAddress);

            if (tokens.length === 0) {
                return [
                    {
                        campaignId: "",
                        detail: "No claimable tokens available",
                    },
                ];
            }

            const tokenAddresses = tokens.map((t) => t.address);

            const { hash } = await walletClient.sendTransaction({
                to: MERKL_CAMPAIGN_ADDRESS as `0x${string}`,
                abi: MERKL_CAMPAIGN_ABI,
                functionName: "claim",
                args: [users, tokenAddresses, amounts, proofs],
            });

            const results: ClaimResultProps[] = tokens.map((token, i) => ({
                campaignId: token.address,
                detail: "Claimed",
                amount: amounts[i],
                transactionHash: hash,
                chainId: chainId,
                nameToken: token.nameToken,
                decimals: token.decimals,
            }));

            return results;
        } catch (error) {
            throw error instanceof Error ? error.message : JSON.stringify(error);
        }
    }

    private extractRewardData(
        rewardsData: MerklRewardResponse[],
        chainId: number,
        userAddress: string,
    ): { users: string[]; tokens: TokenInfo[]; amounts: string[]; proofs: string[][] } {
        const users: string[] = [];
        const tokens: TokenInfo[] = [];
        const amounts: string[] = [];
        const proofs: string[][] = [];

        for (const rewardsObj of rewardsData) {
            if (rewardsObj.chain.id !== chainId) continue;
            for (const reward of rewardsObj.rewards) {
                if (!this.isRewardValid(reward)) continue;

                users.push(userAddress);
                tokens.push({
                    address: reward.token.address,
                    nameToken: reward.token.symbol,
                    decimals: reward.token.decimals,
                });
                amounts.push(reward.amount);
                proofs.push(reward.proofs);
            }
        }

        if (!(users.length === tokens.length && tokens.length === amounts.length && amounts.length === proofs.length)) {
            throw new Error("Mismatch in reward data arrays lengths");
        }

        return { users, tokens, amounts, proofs };
    }

    private isRewardValid(reward: RewardMetadata): boolean {
        return Boolean(
            reward.token?.address &&
                reward.token?.symbol &&
                reward.token?.decimals != null &&
                reward.amount &&
                reward.proofs &&
                Array.isArray(reward.proofs) &&
                BigInt(reward.claimed) === 0n,
        );
    }
}
