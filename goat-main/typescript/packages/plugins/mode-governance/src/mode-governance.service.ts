import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { erc20Abi, formatUnits } from "viem";
import { VOTING_ESCROW_ABI } from "./abi";
import { BPT_TOKEN_ADDRESS, BPT_VOTING_ESCROW, MODE_TOKEN_ADDRESS, MODE_VOTING_ESCROW } from "./constants";
import { ExecuteGovernanceStakeParameters, GetBalanceParameters, GetModeGovernanceInfoParameters } from "./parameters";

export class ModeGovernanceService {
    @Tool({
        description: "Executes the staking transaction of MODE or BPT tokens for governance.",
    })
    async executeGovernanceStake(walletClient: EVMWalletClient, parameters: ExecuteGovernanceStakeParameters) {
        try {
            const escrowAddress = parameters.tokenType === "MODE" ? MODE_VOTING_ESCROW : BPT_VOTING_ESCROW;
            const tokenAddress = parameters.tokenType === "MODE" ? MODE_TOKEN_ADDRESS : BPT_TOKEN_ADDRESS;

            const amount = BigInt(parameters.amount ?? "0");

            const currentAllowance = await walletClient.read({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "allowance",
                args: [walletClient.getAddress(), escrowAddress],
            });

            if (!currentAllowance || currentAllowance.value === undefined) {
                throw new Error("Allowance value is undefined");
            }
            const allowance = BigInt(currentAllowance.value as string);

            if (allowance < amount) {
                await walletClient.sendTransaction({
                    to: tokenAddress,
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [escrowAddress, amount],
                });
            }

            const stakeTx = await walletClient.sendTransaction({
                to: escrowAddress,
                abi: VOTING_ESCROW_ABI,
                functionName: "createLock",
                args: [amount],
            });

            return {
                amount: amount.toString(),
                allowance: allowance.toString(),
                stakeHash: stakeTx,
            };
        } catch (error) {
            return { error };
        }
    }

    @Tool({
        description: "Retrieves detailed MODE governance information, staked tokens, and voting power.",
    })
    async getModeGovernanceInfo(walletClient: EVMWalletClient, parameters: GetModeGovernanceInfoParameters) {
        const escrowAddress = parameters.tokenType === "MODE" ? MODE_VOTING_ESCROW : BPT_VOTING_ESCROW;
        const userAddress = await walletClient.getAddress();

        const tokenIds = (await walletClient.read({
            address: escrowAddress,
            abi: VOTING_ESCROW_ABI,
            functionName: "ownedTokens",
            args: [userAddress],
        })) as unknown as bigint[];

        if (tokenIds.length === 0) {
            return {
                stakedAmount: "0",
                startTime: 0,
                votingPower: "0",
                isVoting: false,
            };
        }

        const tokenId = tokenIds[0];
        const [amount, start] = (await walletClient.read({
            address: escrowAddress,
            abi: VOTING_ESCROW_ABI,
            functionName: "locked",
            args: [tokenId],
        })) as unknown as [bigint, bigint];

        const votingPower = (await walletClient.read({
            address: escrowAddress,
            abi: VOTING_ESCROW_ABI,
            functionName: "votingPower",
            args: [tokenId],
        })) as unknown as bigint;

        const isVoting = (await walletClient.read({
            address: escrowAddress,
            abi: VOTING_ESCROW_ABI,
            functionName: "isVoting",
            args: [tokenId],
        })) as unknown as boolean;

        return {
            stakedAmount: formatUnits(amount, 18),
            startTime: Number(start),
            votingPower: formatUnits(votingPower, 18),
            isVoting,
        };
    }

    @Tool({
        description:
            "Get the Mode governance voting power for any address. Use 'veMode' or 'veBPT' to check voting power.",
    })
    async getModeGovernanceVotingPower(walletClient: EVMWalletClient, parameters: GetBalanceParameters) {
        const userAddress = parameters.address || (await walletClient.getAddress());

        switch (parameters.tokenType) {
            case "MODE":
            case "veMode":
                return formatUnits(
                    (await walletClient.read({
                        address: MODE_VOTING_ESCROW,
                        abi: VOTING_ESCROW_ABI,
                        functionName: "votingPowerForAccount",
                        args: [userAddress],
                    })) as unknown as bigint,
                    18,
                );
            case "BPT":
            case "veBPT":
                return formatUnits(
                    (await walletClient.read({
                        address: BPT_VOTING_ESCROW,
                        abi: VOTING_ESCROW_ABI,
                        functionName: "votingPowerForAccount",
                        args: [userAddress],
                    })) as unknown as bigint,
                    18,
                );
            default:
                throw new Error("Invalid token type");
        }
    }
}
