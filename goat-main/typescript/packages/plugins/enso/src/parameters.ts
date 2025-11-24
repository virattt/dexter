import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class EnsoRouteParameters extends createToolParameters(
    z.object({
        tokenIn: z
            .string()
            .describe(
                "Address of the token to swap from. For native tokens use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            )
            .regex(
                /^0x[a-fA-F0-9]{40}$/,
                "Must be a valid Ethereum contract address (0x followed by 40 hexadecimal characters)",
            ),
        tokenOut: z
            .string()
            .describe(
                "Address of the token to swap to. For native tokens use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            )
            .regex(
                /^0x[a-fA-F0-9]{40}$/,
                "Must be a valid Ethereum contract address (0x followed by 40 hexadecimal characters)",
            ),
        amountIn: z
            .string()
            .describe(
                `The amount of tokens to send, specified as a string. This should be a decimal number (e.g. "1.5" or "100"). The amount will be automatically adjusted based on the token's decimals.`,
            )
            .regex(/^\d*\.?\d+$/, 'Must be a valid decimal number as a string (e.g. "1.5" or "100")'),
    }),
) {}

export class EnsoCheckApprovalParameters extends createToolParameters(
    z.object({
        token: z.string(),
        amount: z.string(),
        walletAddress: z.string(),
    }),
) {}
