import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class GetTokenInfoBySymbolParameters extends createToolParameters(
    z.object({
        symbol: z.string().describe("The symbol of the token to get the info of (e.g ETH, USDC, DAI)"),
    }),
) {}

export class GetTokenBalanceByAddressParameters extends createToolParameters(
    z.object({
        walletAddress: z
            .string()
            .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid Starknet address (0x followed by 64 hex characters)")
            .describe("The address to get the balance of"),
        tokenAddress: z
            .string()
            .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid Starknet address (0x followed by 64 hex characters)")
            .describe("The contract address of the token to get the balance of"),
        decimals: z.number().describe("The decimals of the token"),
    }),
) {}

export class TransferTokenParameters extends createToolParameters(
    z.object({
        tokenAddress: z
            .string()
            .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid Starknet address (0x followed by 64 hex characters)")
            .describe("The contract address of the token to transfer"),
        to: z
            .string()
            .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid Starknet address (0x followed by 64 hex characters)")
            .describe("The address to transfer the token to"),
        amount: z.string().describe("The amount of tokens to transfer in base unit"),
    }),
) {}

export class ConvertToBaseUnitParameters extends createToolParameters(
    z.object({
        amount: z.number().describe("The amount of tokens to convert to base unit"),
        decimals: z.number().describe("The decimals of the token"),
    }),
) {}
