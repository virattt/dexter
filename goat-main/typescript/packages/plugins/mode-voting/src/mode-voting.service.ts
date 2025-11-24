import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { CLOCK_ABI } from "./abi/clock";
import { GAUGE_VOTER_ABI } from "./abi/gaugeVoter";
import { VOTING_ESCROW_ABI } from "./abi/votingEscrow";
import {
    ChangeVotesParameters,
    GetAllGaugesParameters,
    GetGaugeInfoParameters,
    GetVotingPowerParameters,
    VoteOnGaugesParameters,
} from "./parameters";
// Contract addresses for different voter types
const VOTER_ADDRESSES = {
    veMODE: "0x71439Ae82068E19ea90e4F506c74936aE170Cf58",
    veBPT: "0x2aA8A5C1Af4EA11A1f1F10f3b73cfB30419F77Fb",
} as const;

const CLOCK_ADDRESSES = {
    veMODE: "0x66CC481755f8a9d415e75d29C17B0E3eF2Af70bD",
    veBPT: "0x6d1D6277fBB117d77782a85120796BCb08cAae8a",
} as const;

const VOTING_ESCROW_ADDRESSES = {
    veMODE: "0xff8AB822b8A853b01F9a9E9465321d6Fe77c9D2F",
    veBPT: "0x9c2eFe2a1FBfb601125Bb07a3D5bC6EC91F91e01",
} as const;

const ESCROW_CURVE_ADDRESSES = {
    veMODE: "0x69E57EE7782701DdA44b170Df5b1244C6F02e89b",
    veBPT: "0xf597bcF98E79A3B4c92FA70Eb0c6C47DA0f84Fba",
} as const;

// Interface for gauge information
interface GaugeInfo {
    address: string;
    active: boolean;
    created: number;
    metadataURI: string;
    totalVotes: string;
}

export class ModeVotingService {
    @Tool({
        name: "get_all_gauges_mode",
        description:
            "Get a list of all available voting gauges on Mode Network. Use veMODE for MODE token gauges or veBPT for Balancer Pool Token gauges.",
    })
    async getAllGauges(
        walletClient: EVMWalletClient,
        parameters: GetAllGaugesParameters,
    ): Promise<{ voterType: keyof typeof VOTER_ADDRESSES; gauges: string[] }> {
        try {
            const voterAddress = VOTER_ADDRESSES[parameters.voterType];

            const gaugesResult = await walletClient.read({
                address: voterAddress as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "getAllGauges",
                args: [],
            });
            const gauges = (gaugesResult as { value: string[] }).value;

            return {
                voterType: parameters.voterType,
                gauges: gauges,
            };
        } catch (error) {
            throw Error(`Failed to get gauges for ${parameters.voterType}: ${error}`);
        }
    }

    @Tool({
        name: "get_gauge_info_mode",
        description: "Get detailed information about a specific gauge",
    })
    async getGaugeInfo(walletClient: EVMWalletClient, parameters: GetGaugeInfoParameters): Promise<GaugeInfo> {
        try {
            const gaugeDataResult = await walletClient.read({
                address: VOTER_ADDRESSES[parameters.voterType] as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "getGauge",
                args: [parameters.gaugeAddress],
            });

            const gaugeData = (
                gaugeDataResult as {
                    value: {
                        active: boolean;
                        created: bigint;
                        metadataURI: string;
                    };
                }
            ).value;

            const votesResult = await walletClient.read({
                address: VOTER_ADDRESSES[parameters.voterType] as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "gaugeVotes",
                args: [parameters.gaugeAddress],
            });
            const votes = (votesResult as { value: bigint }).value;

            const gaugeInfo: GaugeInfo = {
                address: parameters.gaugeAddress,
                active: gaugeData.active,
                created: Number(gaugeData.created),
                metadataURI: gaugeData.metadataURI,
                totalVotes: votes.toString(),
            };

            return gaugeInfo;
        } catch (error) {
            throw Error(`Failed to get gauge info: ${error}`);
        }
    }

    @Tool({
        name: "vote_on_gauges_mode",
        description: "Vote on multiple gauges using your veNFT voting power. The sum of weights must equal 100.",
    })
    async voteOnGauges(walletClient: EVMWalletClient, parameters: VoteOnGaugesParameters): Promise<string> {
        try {
            // Check if voting is active
            const clockAddress = CLOCK_ADDRESSES[parameters.voterType];

            const votingActiveResult = await walletClient.read({
                address: clockAddress as `0x${string}`,
                abi: CLOCK_ABI,
                functionName: "votingActive",
                args: [],
            });
            const isVotingActive = (votingActiveResult as { value: boolean }).value;

            if (!isVotingActive) {
                throw new Error("Voting is not currently active");
            }

            // Verify NFT ownership and get voting power
            const voterAddress = VOTER_ADDRESSES[parameters.voterType];
            const escrowAddress = VOTING_ESCROW_ADDRESSES[parameters.voterType];

            const isApprovedResult = await walletClient.read({
                address: escrowAddress as `0x${string}`,
                abi: VOTING_ESCROW_ABI,
                functionName: "isApprovedOrOwner",
                args: [walletClient.getAddress(), parameters.tokenId],
            });
            const isApproved = (isApprovedResult as { value: boolean }).value;

            if (!isApproved) {
                throw new Error("Not approved or owner of the NFT");
            }

            // Validate gauges and prepare vote data
            const votes = parameters.votes.map((vote) => ({
                gauge: vote.gauge as `0x${string}`,
                weight: BigInt(vote.weight),
            }));

            // Sum of weights validation
            const totalWeight = votes.reduce((sum, vote) => sum + BigInt(vote.weight), 0n);
            if (totalWeight !== 100n) {
                throw new Error("Total vote weight must equal 100");
            }

            // Execute vote transaction
            const txHash = await walletClient.sendTransaction({
                to: voterAddress as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "vote",
                args: [parameters.tokenId, votes],
            });

            return `Successfully voted with NFT ${parameters.tokenId}. Transaction: ${txHash.hash}`;
        } catch (error) {
            throw Error(`Failed to vote on gauges: ${error}`);
        }
    }

    @Tool({
        name: "change_votes_mode",
        description: "Change existing votes for a veNFT. Must reset existing votes first.",
    })
    async changeVotes(walletClient: EVMWalletClient, parameters: ChangeVotesParameters): Promise<string> {
        try {
            const voterAddress = VOTER_ADDRESSES[parameters.voterType];

            // First reset existing votes
            const resetTx = await walletClient.sendTransaction({
                to: voterAddress as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "reset",
                args: [parameters.tokenId],
            });

            // Verify votes have been reset by checking usedVotingPower
            const votingPowerResult = await walletClient.read({
                address: voterAddress as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "usedVotingPower",
                args: [parameters.tokenId],
            });
            const usedVotingPower = (votingPowerResult as { value: bigint }).value;

            if (usedVotingPower !== 0n) {
                throw new Error("Failed to reset votes - voting power not cleared");
            }

            // Now submit new votes
            const votes = parameters.votes.map((vote) => ({
                gauge: vote.gauge as `0x${string}`,
                weight: BigInt(vote.weight),
            }));

            // Sum of weights validation
            const totalWeight = votes.reduce((sum, vote) => sum + BigInt(vote.weight), 0n);
            if (totalWeight !== 100n) {
                throw new Error("Total vote weight must equal 100");
            }

            // Execute new vote transaction
            const voteTx = await walletClient.sendTransaction({
                to: voterAddress as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "vote",
                args: [parameters.tokenId, votes],
            });
            return `Successfully changed votes for NFT ${parameters.tokenId}. Reset tx: ${resetTx.hash}, Vote tx: ${voteTx.hash}`;
        } catch (error) {
            throw Error(`Failed to change votes: ${error}`);
        }
    }

    @Tool({
        name: "get_voting_power_mode",
        description: "Get the current voting power for a specific veNFT token ID",
    })
    async getVotingPower(
        walletClient: EVMWalletClient,
        parameters: GetVotingPowerParameters,
    ): Promise<{
        totalVotingPower: string;
        usedVotingPower: string;
        remainingVotingPower: string;
    }> {
        try {
            const escrowAddress = VOTING_ESCROW_ADDRESSES[parameters.voterType];

            const votingPowerResult = await walletClient.read({
                address: escrowAddress as `0x${string}`,
                abi: VOTING_ESCROW_ABI,
                functionName: "votingPowerAt",
                args: [parameters.tokenId, BigInt(Math.floor(Date.now() / 1000))],
            });
            const votingPower = (votingPowerResult as { value: bigint }).value;

            const voterAddress = VOTER_ADDRESSES[parameters.voterType];
            const usedVotingPowerResult = await walletClient.read({
                address: voterAddress as `0x${string}`,
                abi: GAUGE_VOTER_ABI,
                functionName: "usedVotingPower",
                args: [parameters.tokenId],
            });
            const usedVotingPower = (usedVotingPowerResult as { value: bigint }).value;

            const DECIMALS = BigInt(10 ** 18);

            return {
                totalVotingPower: (votingPower / DECIMALS).toString(),
                usedVotingPower: (usedVotingPower / DECIMALS).toString(),
                remainingVotingPower: ((votingPower - usedVotingPower) / DECIMALS).toString(),
            };
        } catch (error) {
            throw Error(`Failed to get voting power: ${error}`);
        }
    }
}
