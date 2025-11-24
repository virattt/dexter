import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class DepositUSDCParameters extends createToolParameters(
    z.object({
        amount: z.string().describe("Amount of USDC to deposit"),
    }),
) {}

export class WithdrawTokenParameters extends createToolParameters(
    z.object({
        amount: z.string().describe("Amount of USDC to withdraw"),
    }),
) {}
