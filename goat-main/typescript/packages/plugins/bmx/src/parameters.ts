import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class OpenIncreasePositionParams extends createToolParameters(
    z.object({
        indexToken: z.string().describe("Token address to long or short (e.g., WETH, WBTC, MODE)"),
        amountIn: z.string().describe("Amount of collateral token to use in base units of collateral token"),
        leverage: z.number().min(2).max(50).default(2).describe("Desired leverage (2-50x)"),
        isLong: z.boolean().default(true).describe("Position direction (true for long, false for short)"),
        executionFee: z.string().optional().describe("Execution fee in native token"),
        referralCode: z.string().optional().describe("Referral code if any"),
    }),
) {}

export class CloseDecreasePositionParams extends createToolParameters(
    z.object({
        indexToken: z.string().describe("Token address of the position to decrease/close"),
        percentage: z.number().min(1).max(100).describe("Percentage of position to close (1-100)"),
        isLong: z.boolean().describe("Position direction (true for long, false for short)"),
        referralCode: z.string().optional().describe("Referral code if any"),
    }),
) {}

export class GetPositionParams extends createToolParameters(
    z.object({
        indexToken: z.string().describe("Token address to check position (e.g., MODE, WETH)"),
        isLong: z.boolean().describe("Position direction (true for long, false for short)"),
    }),
) {}
