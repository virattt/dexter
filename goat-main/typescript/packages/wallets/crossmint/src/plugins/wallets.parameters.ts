import { z } from "zod";

import { createToolParameters } from "@goat-sdk/core";

const supportedChains = ["evm", "solana", "aptos", "cardano", "sui"] as const;

export class CreateWalletForTwitterUserParameters extends createToolParameters(
    z.object({
        username: z.string().describe("The username of the Twitter / X user"),
        chain: z.enum(supportedChains).describe("The chain of the wallet"),
    }),
) {}

export class CreateWalletForEmailParameters extends createToolParameters(
    z.object({
        email: z.string().describe("The email address of the user"),
        chain: z.enum(supportedChains).describe("The chain of the wallet"),
    }),
) {}

export class GetWalletByTwitterUsernameParameters extends createToolParameters(
    z.object({
        username: z.string().describe("The username of the Twitter / X user"),
        chain: z.enum(supportedChains).describe("The chain of the wallet"),
    }),
) {}

export class GetWalletByEmailParameters extends createToolParameters(
    z.object({
        email: z.string().describe("The email address of the user"),
        chain: z.enum(supportedChains).describe("The chain of the wallet"),
    }),
) {}
