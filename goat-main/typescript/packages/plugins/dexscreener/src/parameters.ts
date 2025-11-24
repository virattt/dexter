import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetPairsByChainAndPairParameters extends createToolParameters(
    z.object({
        chainId: z.string().describe("The chain ID of the pair"),
        pairId: z.string().describe("The pair ID to fetch"),
    }),
) {}

export class SearchPairsParameters extends createToolParameters(
    z.object({
        query: z.string().describe("The search query string"),
    }),
) {}

export class GetTokenPairsParameters extends createToolParameters(
    z.object({
        tokenAddresses: z.array(z.string()).max(30).describe("List of up to 30 token addresses"),
    }),
) {}
