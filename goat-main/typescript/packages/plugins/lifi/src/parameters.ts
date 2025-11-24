import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetQuoteParameters extends createToolParameters(
    z.object({
        fromChain: z
            .string()
            .describe(
                "Source chain name entered by user like 'ethereum', 'polygon', 'optimism', 'arbitrum', 'mantle', 'base', 'avalanche', 'binance', 'gnosis', etc.",
            ),
        toChain: z
            .string()
            .describe(
                "Destination chain name entered by user like 'ethereum', 'polygon', 'optimism', 'arbitrum', 'mantle', 'base', 'avalanche', 'binance', 'gnosis', etc.",
            ),
        fromToken: z.string().describe("Source token symbol like 'USDC', 'USDT', 'DAI', etc."),
        toToken: z.string().describe("Destination token symbol like 'USDC', 'USDT', 'DAI', etc."),
        fromAmount: z.string().describe("Amount to send in base units (e.g., 1000000 for 1 USDC)"),
    }),
) {}
