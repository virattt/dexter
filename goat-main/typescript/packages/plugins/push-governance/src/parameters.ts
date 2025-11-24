import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class DelegateParams extends createToolParameters(
    z.object({
        delegateAddress: z
            .string()
            .optional()
            .describe(
                "The address to delegate your voting power to. If not provided, the address of the wallet client will be used.",
            ),
    }),
) {}

export class GetPushTokenAddressParams extends createToolParameters(
    z.object({
        symbol: z.string().describe("Get info for tokens suported by push."),
    }),
) {}
