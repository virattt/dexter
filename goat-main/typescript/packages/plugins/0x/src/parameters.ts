import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetPriceParameters extends createToolParameters(
    z.object({
        chainId: z.number().describe("The chain ID to get the price on"),
        sellToken: z.string().describe("The token to sell"),
        buyToken: z.string().describe("The token to buy"),
        sellAmount: z.string().describe("The amount of tokens to sell in base units"),
        slippageBps: z
            .number()
            .optional()
            .describe(
                "The maximum acceptable slippage of the buyToken in Bps. If this parameter is set to 0, no slippage will be tolerated. If not provided, the default slippage tolerance is 100Bps",
            ),
    }),
) {}
