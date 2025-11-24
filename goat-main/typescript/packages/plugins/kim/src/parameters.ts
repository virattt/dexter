import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetSwapRouterAddressParams extends createToolParameters(z.object({})) {}

export const pathSchema = z.object({
    tokenIn: z.string().describe("Address of the first token in the path"),
    tokenOut: z.string().describe("Address of the last token in the path"),
    intermediateTokens: z.array(z.string()).describe("Addresses of the intermediate tokens in the path"),
    fees: z.array(z.number()).describe("Fee tiers between each hop"),
});

export class ExactInputParams extends createToolParameters(
    z.object({
        path: pathSchema.describe("The path of the swap"),
        recipient: z.string().describe("Address to receive the output tokens"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the swap in seconds from now"),
        amountIn: z.string().describe("The amount of tokens to swap in base units"),
        amountOutMinimum: z.string().describe("The minimum amount of tokens to receive in base units"),
    }),
) {}

export class ExactOutputParams extends createToolParameters(
    z.object({
        path: z.any().describe("The path of the swap"),
        recipient: z.string().describe("The address to receive the output tokens"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the swap in seconds from now"),
        amountOut: z.string().describe("The amount of tokens to swap out in base units"),
        amountInMaximum: z.string().describe("The maximum amount of tokens to swap in in base units"),
    }),
) {}

export class ExactInputSingleParams extends createToolParameters(
    z.object({
        tokenInAddress: z.string().describe("The address of the token to swap in"),
        tokenOutAddress: z.string().describe("The address of the token to swap out"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the swap in seconds from now"),
        amountIn: z.string().describe("The amount of tokens to swap in in base units"),
        amountOutMinimum: z.string().describe("The minimum amount of tokens to receive in base units"),
        limitSqrtPrice: z.string().describe("The limit price for the swap"),
    }),
) {}

export class ExactOutputSingleParams extends createToolParameters(
    z.object({
        tokenInAddress: z.string().describe("The address of the token to swap in"),
        tokenOutAddress: z.string().describe("The address of the token to swap out"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the swap in seconds from now"),
        amountOut: z.string().describe("The amount of tokens to swap out in base units of the output token"),
        amountInMaximum: z.string().describe("The maximum amount of tokens to swap in base units of the input token"),
        limitSqrtPrice: z.string().describe("The limit price for the swap"),
    }),
) {}

export class DefaultConfigurationForPoolParams extends createToolParameters(
    z.object({
        poolAddress: z.string().describe("The address of the pool"),
    }),
) {}

export class PoolByPairParams extends createToolParameters(
    z.object({
        token0: z.string().describe("The first token in the pair"),
        token1: z.string().describe("The second token in the pair"),
    }),
) {}

export class MintParams extends createToolParameters(
    z.object({
        token0Address: z.string().describe("The address of the first token in the pair"),
        token1Address: z.string().describe("The address of the second token in the pair"),
        tickLower: z.number().optional().describe("The lower tick for the liquidity"),
        tickUpper: z.number().optional().describe("The upper tick for the liquidity"),
        amount0Desired: z.string().describe("The amount of token0 to add in base units"),
        amount1Desired: z.string().describe("The amount of token1 to add in base units"),
        amount0Min: z.string().describe("The minimum amount of token0 to add in base units"),
        amount1Min: z.string().describe("The minimum amount of token1 to add in base units"),
        deadline: z.number().describe("The deadline for the swap"),
    }),
) {}

export class IncreaseLiquidityParams extends createToolParameters(
    z.object({
        token0Address: z.string().describe("The address of the first token in the pair"),
        token1Address: z.string().describe("The address of the second token in the pair"),
        tokenId: z.string().describe("The token id of the liquidity"),
        amount0Desired: z.string().describe("The amount of token0 to add in base units"),
        amount1Desired: z.string().describe("The amount of token1 to add in base units"),
        amount0Min: z.string().describe("The minimum amount of token0 to add in base units"),
        amount1Min: z.string().describe("The minimum amount of token1 to add in base units"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the swap in seconds from now"),
    }),
) {}

export class DecreaseLiquidityParams extends createToolParameters(
    z.object({
        tokenId: z.string().describe("The token id of the liquidity"),
        percentage: z.number().min(1).max(100).describe("The percentage of liquidity to remove (1-100)"),
        amount0Min: z.string().optional().describe("The minimum amount of token0 to remove in base units"),
        amount1Min: z.string().optional().describe("The minimum amount of token1 to remove in base units"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the transaction in seconds from now"),
    }),
) {}

export class CollectParams extends createToolParameters(
    z.object({
        tokenId: z.string().describe("The token id of the LP position whose tokens are being collected"),
    }),
) {}

export class BurnParams extends createToolParameters(
    z.object({
        tokenId: z.string().describe("The token id of the liquidity position to be burned"),
    }),
) {}

export class GlobalStateResponseParams extends createToolParameters(
    z.object({
        price: z.string().describe("The current price of the pool"),
        tick: z.number().describe("The current tick of the pool"),
        lastFee: z.number().describe("The current (last known) fee in hundredths of a bip"),
        pluginCongig: z.number().describe("The current plugin config as bitmap"),
        communityFee: z
            .number()
            .describe("The community fee represented as a percent of all collected fee in thousandths"),
        unlocked: z.boolean().describe("Whether the pool is unlocked"),
    }),
) {}
