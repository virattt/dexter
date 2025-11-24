import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetTokenReportParameters extends createToolParameters(
    z.object({
        mint: z.string().describe("The token mint address to generate the report for"),
    }),
) {}

export class NoParameters extends createToolParameters(z.object({})) {}
