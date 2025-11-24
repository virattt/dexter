import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class ClaimStakingRewardsParams extends createToolParameters(
    z.object({
        campaignIds: z
            .array(z.string())
            .optional()
            .describe("Optional array of UUIDs of the Hedgey staking rewards campaigns"),
    }),
) {}
