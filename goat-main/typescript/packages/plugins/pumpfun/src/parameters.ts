import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class CreateAndBuyTokenParameters extends createToolParameters(
    z.object({
        name: z.string().describe("The name of the token"),
        symbol: z.string().describe("The symbol of the token"),
        description: z.string().describe("The description of the token"),
        amountToBuyInSol: z.number().default(0).describe("The amount of tokens to buy in lamports (base units)"),
        slippage: z.number().default(5).describe("The slippage of the transaction"),
        priorityFee: z.number().default(0.0005).describe("The priority fee of the transaction"),
        imageUrl: z.string().describe("URL of the image file of the token"),
        twitter: z.string().optional().describe("The twitter / X handle of the token"),
        telegram: z.string().optional().describe("The telegram handle of the token"),
        website: z.string().optional().describe("The website of the token"),
    }),
) {}
