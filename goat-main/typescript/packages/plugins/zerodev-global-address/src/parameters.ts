import { createToolParameters } from "@goat-sdk/core";
import { arbitrum, base, mainnet, mode, optimism, scroll } from "viem/chains";
import { z } from "zod";

const SupportedChains = z
    .enum(["base", "arbitrum", "mainnet", "optimism", "scroll", "mode"])
    .describe("The supported chains for global account deployment");

export const GlobalAddressConfigSchema = z.object({
    owner: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
        .transform((val) => val as `0x${string}`)
        .describe("The owner address of the global account")
        .optional(),
    destinationChain: SupportedChains.transform((val) => {
        switch (val) {
            case "base":
                return base;
            case "arbitrum":
                return arbitrum;
            case "mainnet":
                return mainnet;
            case "optimism":
                return optimism;
            case "scroll":
                return scroll;
            case "mode":
                return mode;
        }
    })
        .describe("The chain where tokens will be bridged to (e.g., optimism, base, arbitrum)")
        .default("optimism")
        .optional(),
    slippage: z
        .number()
        .min(0)
        .max(10000)
        .describe("Slippage tolerance in basis points (default: 5000 = 50%)")
        .default(5000)
        .optional(),
});

export class CreateGlobalAddressConfigParams extends createToolParameters(GlobalAddressConfigSchema) {}
