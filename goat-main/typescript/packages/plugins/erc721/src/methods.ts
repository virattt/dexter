import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import type { z } from "zod";
import { ERC721_ABI } from "./abi";
import type {
    approveParametersSchema,
    getBalanceParametersSchema,
    transferFromParametersSchema,
    transferParametersSchema,
} from "./parameters";
import type { ChainSpecificToken } from "./token";

export async function balanceOf(
    walletClient: EVMWalletClient,
    token: ChainSpecificToken,
    parameters: z.infer<typeof getBalanceParametersSchema>,
): Promise<string> {
    try {
        const rawBalance = await walletClient.read({
            address: token.contractAddress,
            abi: ERC721_ABI,
            functionName: "balanceOf",
            args: [parameters.wallet],
        });

        return (rawBalance.value as bigint).toString();
    } catch (error) {
        throw Error(`Failed to fetch balance: ${error}`);
    }
}

export async function transfer(
    walletClient: EVMWalletClient,
    token: ChainSpecificToken,
    parameters: z.infer<typeof transferParametersSchema>,
): Promise<string> {
    try {
        const to = parameters.to as `0x${string}`;

        const hash = await walletClient.sendTransaction({
            to: token.contractAddress,
            abi: ERC721_ABI,
            functionName: "safeTransferFrom",
            args: [walletClient.getAddress(), to, parameters.tokenId],
        });

        return hash.hash;
    } catch (error) {
        throw Error(`Failed to transfer: ${error}`);
    }
}

export async function totalSupply(walletClient: EVMWalletClient, token: ChainSpecificToken): Promise<string> {
    try {
        const rawTotalSupply = await walletClient.read({
            address: token.contractAddress,
            abi: ERC721_ABI,
            functionName: "totalSupply",
        });

        return (rawTotalSupply.value as bigint).toString();
    } catch (error) {
        throw Error(`Failed to fetch total supply: ${error}`);
    }
}

export async function approve(
    walletClient: EVMWalletClient,
    token: ChainSpecificToken,
    parameters: z.infer<typeof approveParametersSchema>,
): Promise<string> {
    try {
        const spender = parameters.spender as `0x${string}`;

        const hash = await walletClient.sendTransaction({
            to: token.contractAddress,
            abi: ERC721_ABI,
            functionName: "approve",
            args: [spender, parameters.tokenId],
        });

        return hash.hash;
    } catch (error) {
        throw Error(`Failed to approve: ${error}`);
    }
}

export async function transferFrom(
    walletClient: EVMWalletClient,
    token: ChainSpecificToken,
    parameters: z.infer<typeof transferFromParametersSchema>,
): Promise<string> {
    try {
        const from = parameters.from as `0x${string}`;
        const to = parameters.to as `0x${string}`;

        const hash = await walletClient.sendTransaction({
            to: token.contractAddress,
            abi: ERC721_ABI,
            functionName: "safeTransferFrom",
            args: [from, to, parameters.tokenId],
        });

        return hash.hash;
    } catch (error) {
        throw Error(`Failed to transfer from: ${error}`);
    }
}
