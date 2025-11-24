import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class DepositParams extends createToolParameters(
    z.object({
        tokenAddress: z.string().describe("The address of the token to deposit"),
        amountIn: z.string().describe("The amount of tokens to deposit in base units"),
        minOut: z.string().describe("The minimum amount of tokens to receive in base units"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the swap in seconds from now"),
    }),
) {}

export class DepositETHParams extends createToolParameters(
    z.object({
        minOut: z.string().describe("The minimum amount of ETH to receive in base units"),
        deadline: z
            .number()
            .optional()
            .default(60 * 60 * 24)
            .describe("The deadline for the swap in seconds from now"),
        value: z.string().describe("The amount of ETH to send in base units"),
    }),
) {}

export class BalanceOfParams extends createToolParameters(
    z.object({
        address: z.string().describe("The address to check the balance of"),
    }),
) {}

export class GetDepositAddressParams extends createToolParameters(
    z.object({}), // Empty schema for getRenzoDepositAddress
) {}
