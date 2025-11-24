import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class SwapExactTokensParams extends createToolParameters(
    z.object({
        tokenIn: z.string().describe("The address of the token to swap from. if this is ETH, use 0x0."),
        tokenOut: z.string().describe("The address of the token to swap to. if this is ETH, use 0x0."),
        amountIn: z.string().describe("The amount of input tokens to swap in base units"),
        amountOutMin: z.string().describe("The minimum amount of output tokens to receive in base units"),
        stable: z.boolean().describe("Whether to use stable or volatile pool for swap"),
        to: z.string().optional().describe("The address to receive the output tokens"),
        deadline: z
            .number()
            .optional()
            .default(() => Math.floor(Date.now() / 1000) + 3600)
            .describe("The deadline for the swap in seconds from now"),
    }),
) {}

export class GetInfoVelodromeTokensParams extends createToolParameters(
    z.object({
        tokenName: z.string().describe("Get info for tokens suported by velodrome."),
    }),
) {}

export class AddLiquidityParams extends createToolParameters(
    z.object({
        token0: z.string().describe("The address of the first token"),
        token1: z.string().describe("The address of the second token"),
        stable: z.boolean().describe("Whether this is a stable or volatile pool"),
        amount0Desired: z.string().describe("The desired amount of first token to add in base units"),
        amount1Desired: z.string().describe("The desired amount of second token to add in base units"),
        amount0Min: z.string().describe("The minimum amount of first token to add in base units"),
        amount1Min: z.string().describe("The minimum amount of second token to add in base units"),
        to: z.string().optional().describe("The address to receive the LP tokens"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the transaction in seconds from now"),
    }),
) {}

export class removeLiquidityParams extends createToolParameters(
    z.object({
        token0: z.string().describe("Address of the first token"),
        token1: z.string().describe("Address of the second token"),
        stable: z.boolean().describe("Whether the pool is stable or volatile"),
        amount: z.string().optional().describe("Amount to remove (e.g., 'half', 'all')"),
        liquidity: z.string().optional().describe("Specific amount of LP tokens to remove"),
        amountAMin: z.string().optional().describe("Minimum amount of token0 to receive"),
        amountBMin: z.string().optional().describe("Minimum amount of token1 to receive"),
        to: z.string().optional().describe("Address to receive tokens, defaults to sender"),
        deadline: z
            .number()
            .optional()
            .default(() => Math.floor(Date.now() / 1000) + 3600)
            .describe("Deadline for the transaction in seconds"),
    }),
) {}
