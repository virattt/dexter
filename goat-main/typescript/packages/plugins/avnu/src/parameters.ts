import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export const SwapConfigSchema = z.object({
    sellTokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid Starknet address (0x followed by 64 hex characters)")
        .describe("The address of the token to sell"),

    buyTokenAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid Starknet address (0x followed by 64 hex characters)")
        .describe("The address of the token to buy"),

    sellAmount: z.string().describe("The amount of tokens to sell in base units"),
    slippage: z.number().min(0).max(0.5).describe("Slippage tolerance (default: 0.3 = 30%)").default(0.3),
});

export class SwapConfigParams extends createToolParameters(SwapConfigSchema) {}
