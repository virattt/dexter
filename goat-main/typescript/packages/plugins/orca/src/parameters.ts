import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class ClosePositionParameters extends createToolParameters(
    z.object({
        positionMintAddress: z.string().describe("The mint address of the liquidity position to close."),
    }),
) {}

export class CreateCLMMParameters extends createToolParameters(
    z.object({
        mintDeploy: z.string().describe("The mint of the token you want to deploy."),
        mintPair: z.string().describe("The mint of the token you want to pair the deployed mint with."),
        initialPrice: z.string().describe("The mint address of the other token in the pool, eg. USDC."),
        feeTier: z.string().describe(
            "The fee tier percentage for the pool, determining tick spacing and fee collection rates. \
        Available fee tiers are 0.01, 0.02, 0.04, 0.05, 0.16, 0.30, 0.65, 1.0, 2.0",
        ),
    }),
) {}

export class CreateSingleSidedPoolParameters extends createToolParameters(
    z.object({
        depositTokenAmount: z
            .string()
            .describe("The amount of the deposit token (including the decimals) to contribute to the pool."),
        depositTokenMint: z
            .string()
            .describe("The mint address of the token being deposited into the pool, eg. NEW_TOKEN."),
        otherTokenMint: z.string().describe("The mint address of the other token in the pool, eg. USDC."),
        startPrice: z
            .string()
            .describe("The initial start price of the deposit token in terms of the other token, eg. 0.001 USDC."),
        maxPrice: z.string().describe("The initial maximum price of the token."),
        feeTier: z.string().describe(
            "The fee tier percentage for the pool, determining tick spacing and fee collection rates. \
        Available fee tiers are 0.01, 0.02, 0.04, 0.05, 0.16, 0.30, 0.65, 1.0, 2.0",
        ),
    }),
) {}

export class FetchPositionsByOwnerParameters extends createToolParameters(
    z.object({
        owner: z
            .string()
            .describe(
                "Wallet address of the owner for who you want to fetch the positions. If left blank, will default to agent.",
            ),
    }),
) {}

export class OpenCenteredPositionParameters extends createToolParameters(
    z.object({
        whirlpoolAddress: z.string().describe("The address of the Orca Whirlpool."),
        priceOffsetBps: z.string().describe("The basis point offset (one side) from the current pool price."),
        inputTokenMint: z.string().describe("The mint address of the token to deposit."),
        inputAmount: z.string().describe("The amount of the input token to deposit."),
    }),
) {}

export class OpenSingleSidedPositionParameters extends createToolParameters(
    z.object({
        whirlpoolAddress: z.string().describe("The address of the Orca Whirlpool."),
        distanceFromCurrentPriceBps: z
            .string()
            .describe("The basis point offset from the current price for the lower bound."),
        widthBps: z.string().describe("The width of the range as a percentage increment from the lower bound."),
        inputTokenMint: z.string().describe("The mint address of the token to deposit."),
        inputAmount: z.string().describe("The amount of the input token to deposit."),
    }),
) {}
