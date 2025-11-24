import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class SupplyAssetParameters extends createToolParameters(
    z.object({
        poolId: z.string().describe("The ID of the pool to supply to"),
        asset: z.string().describe("The asset to supply (e.g. ionUSDC, ionWETH)"),
        amount: z.string().describe("The amount to supply in base units"),
    }),
) {}

export class BorrowAssetParameters extends createToolParameters(
    z.object({
        asset: z.string().describe("The asset to borrow (e.g. ionUSDC, ionWETH)"),
        amount: z.string().describe("The amount to borrow in base units"),
    }),
) {}

export class GetHealthMetricsParameters extends createToolParameters(z.object({})) {}

export class LoopAssetParameters extends createToolParameters(
    z.object({
        asset: z.string().describe("The asset to loop (e.g. ionWeETH, iondMBTC)"),
        initialAmount: z.string().describe("Initial amount to supply"),
        targetltv: z.string().describe("Target Loan-to-Value ratio"),
        maxIterations: z.number().optional().describe("Maximum number of loop iterations"),
    }),
) {}

export class SwapCollateralParameters extends createToolParameters(
    z.object({
        fromAsset: z.string().describe("Asset to swap from"),
        toAsset: z.string().describe("Asset to swap to"),
        amount: z.string().describe("Amount to swap"),
    }),
) {}

export class GetPoolDataParameters extends createToolParameters(
    z.object({
        poolId: z.string().describe("The pool ID to get data for"),
    }),
) {}

export class GetPoolAssetsParameters extends createToolParameters(
    z.object({
        poolId: z.string().describe("The pool ID to get assets for"),
    }),
) {}

export class GetPoolRatesParameters extends createToolParameters(
    z.object({
        poolId: z.string().describe("The pool ID to get rates for"),
        asset: z.string().describe("The asset to get rates for (e.g. ionUSDC, ionWETH)"),
    }),
) {}

export class GetUserPositionParameters extends createToolParameters(
    z.object({
        poolId: z.string().describe("The pool ID to get position for"),
        user: z.string().describe("The user address to get position for"),
    }),
) {}
