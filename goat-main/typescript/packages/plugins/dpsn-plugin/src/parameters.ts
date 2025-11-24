import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class SubscribeToTopicParameters extends createToolParameters(
    z.object({
        dpsn_topic: z.string().describe("The dpsn_topic to subscribe to"),
    }),
) {}

export class UnsubscribeFromTopicParameters extends createToolParameters(
    z.object({
        dpsn_topic: z.string().describe("The dpsn_topic  to unsubscribe from"),
    }),
) {}
