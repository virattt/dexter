import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

/**
 * Schema for dispersing Ether to multiple recipients.
 */
export class SprayEtherParams extends createToolParameters(
    z.object({
        recipients: z
            .array(
                z
                    .string()
                    .regex(
                        /^0x[a-fA-F0-9]{40}$/,
                        "Each recipient must be a valid Ethereum address 42 hexadecimal characters included 0x-prefixed.",
                    ),
            )
            .nonempty({
                message: "The recipients array must have at least one valid Ethereum address.",
            }),
        amounts: z.array(z.string().regex(/^\d+$/, "Each amount must be a positive in gwei units")).nonempty({
            message: "The amounts array must have at least one valid amount specified",
        }),
    }),
) {}

/**
 * Schema for dispersing ERC-20 tokens to multiple recipients.
 */
export class SprayErc20TokenParams extends createToolParameters(
    z.object({
        token: z.string().describe("The address of the erc20 token suported by modespray."),
        recipients: z
            .array(
                z
                    .string()
                    .regex(
                        /^0x[a-fA-F0-9]{40}$/,
                        "Each recipient must be a valid Ethereum address 42 hexadecimal characters included 0x-prefixed.",
                    ),
            )
            .nonempty({
                message: "The recipients array must have at least one valid Ethereum address.",
            }),
        amounts: z
            .array(z.string().regex(/^\d+$/, "Each amount must be a positive integer in the token unit."))
            .nonempty({
                message: "The amounts array must have at least one valid amount specified in the token unit.",
            }),
    }),
) {}

export class GetInfoModeSprayTokensParams extends createToolParameters(
    z.object({
        token: z.string().describe("The symbol of the erc20 token to get info for tokens suported by modespray."),
    }),
) {}
