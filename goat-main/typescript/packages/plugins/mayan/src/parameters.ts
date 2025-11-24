import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

const commonParams = {
    amount: z
        .string()
        .refine((val) => !Number.isNaN(+val) && Number(val).toString() === val, "amount is not a valid number")
        .describe("The amount of tokens to swap"),
    fromToken: z.string().describe("Token symbol or contract address"),
    toChain: z
        .enum(["solana", "ethereum", "bsc", "polygon", "avalanche", "arbitrum", "optimism", "base", "sui"])
        .describe("Destination token chain"),
    toToken: z.string().describe("Token symbol or contract address"),
    dstAddr: z.string().min(32, "Invalid destination address"),
    slippageBps: z.number().min(0).max(10000).optional().describe("The slippage in bps"),
};

export class SwapParameters extends createToolParameters(z.object(commonParams)) {}

export class EVMSwapParameters extends createToolParameters(
    z.object({
        ...commonParams,
        fromChain: z
            .enum(["ethereum", "bsc", "polygon", "avalanche", "arbitrum", "optimism", "base"])
            .describe("From EVM token chain"),
    }),
) {}
