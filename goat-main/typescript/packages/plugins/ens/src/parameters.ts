import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class EnsParameters extends createToolParameters(
    z.object({
        ensName: z.string().describe("The ENS name to resolve"),
    }),
) {}
