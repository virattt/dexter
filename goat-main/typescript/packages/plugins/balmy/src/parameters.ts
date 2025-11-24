// @ts-nocheck
import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetQuoteParameters extends createToolParameters(
    z.object({
        chainId: z.number().describe("The chain ID"),
        tokenIn: z.string().describe("The input token address"),
        tokenOut: z.string().describe("The output token address"),
        order: z
            .object({
                type: z.enum(["sell", "buy"]),
                amount: z.string().describe("amount in basis points (e.g., 1000000 for 1 USDC)"),
            })
            .describe("Order details"),
        slippagePercentage: z.number().describe("Maximum allowed slippage (e.g., 0.5 for 0.5%)"),
        takerAddress: z.string().optional().describe("The address of the taker"),
    }),
) {}

export class ExecuteSwapParameters extends GetQuoteParameters {}
