import { z } from "zod";

export const getBalanceParametersSchema = z.object({
    address: z.string().describe("The wallet address to check the balance for."),
    tokenAddress: z
        .string()
        .optional()
        .describe("Optional: The mint address of the SPL token. If omitted, the native SOL balance is returned."),
});

export const sendTokenParametersSchema = z.object({
    recipient: z.string().describe("The recipient's Solana address (wallet address)."),
    baseUnitsAmount: z
        .string()
        .describe("The amount of the token/SOL to send (in base units, e.g., '1000000000000000000')."),
    tokenAddress: z
        .string()
        .optional()
        .describe("Optional: The mint address of the SPL token to send. If omitted, native SOL is sent."),
});

export const getTokenInfoBySymbolParametersSchema = z.object({
    symbol: z.string().describe("The symbol (ticker) of the token (e.g., 'USDC', 'SOL')."),
});

export const convertToBaseUnitsParametersSchema = z.object({
    amount: z.string().describe("The amount to convert (in human-readable units)."),
    tokenAddress: z
        .string()
        .optional()
        .describe("Optional: The mint address of the token. If omitted, native SOL decimals are used."),
});

export const convertFromBaseUnitsParametersSchema = z.object({
    amount: z.string().describe("The amount to convert (in base units, e.g., lamports)."),
    tokenAddress: z
        .string()
        .optional()
        .describe("Optional: The mint address of the token. If omitted, native SOL decimals are used."),
});
