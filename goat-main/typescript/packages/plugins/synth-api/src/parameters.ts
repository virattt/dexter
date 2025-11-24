import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

// Commented out for now because Synth Subnet support only default parameters for now
export class SynthApiPredictionBestParameters extends createToolParameters(
    z.object({
        // asset: z
        //     .string()
        //     .default("BTC")
        //     .describe("The asset to get the prediction for"),
        // time_increment: z.number().default(300).describe("The time increment of the prediction"),
        // time_length: z.number().default(86400).describe("The time length of the prediction"),
    }),
) {}
