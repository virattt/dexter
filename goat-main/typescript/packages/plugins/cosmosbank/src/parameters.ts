import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class sendTokenObjectParametersSchema extends createToolParameters(
    z.object({
        toAddress: z.string().describe("The address to send tokens to"),
        amount: z
            .object({ symbol: z.string(), amount: z.string() })
            .describe("A token data having its symbol and the amount of token to be sent"),
    }),
) {}

export class getBalanceParametersSchema extends createToolParameters(
    z.object({
        address: z.string().describe("The address required to retrieve the balance"),
        symbol: z.string().describe("The token symbol required to retrieve the balance"),
    }),
) {}

export class supplyOfParametersSchema extends createToolParameters(
    z.object({
        symbol: z.string().describe("The token symbol required to retrieve the totalsupply"),
    }),
) {}

export class denomMetadataParametersSchema extends createToolParameters(
    z.object({
        symbol: z.string().describe("The token symbol required to retrieve the metadata"),
    }),
) {}
