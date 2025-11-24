import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class LoopDepositParameters extends createToolParameters(
    z.object({
        assetAddress: z.string().describe("The address of the asset to deposit and borrow"),
        initialAmount: z.string().describe("The initial amount of the asset to deposit in base units"),
        numLoops: z.number().min(1).max(5).default(2).describe("Number of loops to perform, a number between 1 and 5"),
        referralCode: z.string().optional().default("0").describe("Referral code"),
    }),
) {}

export class LoopWithdrawParameters extends createToolParameters(
    z.object({
        assetAddress: z.string().describe("The address of the asset to withdraw in base units"),
    }),
) {}

export class BorrowIUSDParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the token to deposit"),
        tokenAmount: z.string().describe("Amount of token to deposit in base units"),
        maxFeePercentage: z.string().describe("Maximum fee percentage for the borrowing operation"),
        iUSDAmount: z.string().describe("Amount of iUSD to borrow"),
        upperHint: z
            .string()
            .optional()
            .default("0x0000000000000000000000000000000000000000")
            .describe("Upper hint for the trove insertion"),
        lowerHint: z
            .string()
            .optional()
            .default("0x0000000000000000000000000000000000000000")
            .describe("Lower hint for the trove insertion"),
    }),
) {}

export class RepayIUSDParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The token address used"),
    }),
) {}

export class MonitorPositionParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The token address to check position for"),
    }),
) {}

export class CalculateMaxWithdrawableParameters extends createToolParameters(
    z.object({
        assetAddress: z.string().describe("The address of the asset to calculate max withdrawable amount for"),
    }),
) {}

export class GetIcVaultParameters extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the token to get corresponding ic-vault for"),
    }),
) {}

export class GetBorrowerAddressParameters extends createToolParameters(
    z.object({
        // Empty object as we don't need any parameters,
        // the borrower address is constant for all operations
    }),
) {}

export class GetLendingPoolAddressParameters extends createToolParameters(z.object({})) {}
