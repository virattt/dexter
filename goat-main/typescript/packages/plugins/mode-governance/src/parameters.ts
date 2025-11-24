import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

const TokenType = z.enum(["MODE", "BPT"]);
const ExtendedTokenType = z.enum(["MODE", "BPT", "veMode", "veBPT"]);

type TokenType = z.infer<typeof TokenType>;
type ExtendedTokenType = z.infer<typeof ExtendedTokenType>;

export type StakeParametersType = z.infer<typeof StakeSchema>;
export type GetStakeInfoParametersType = z.infer<typeof GetStakeInfoSchema>;
export type GetBalanceParametersType = z.infer<typeof GetBalanceSchema>;

const StakeSchema = z.object({
    amount: z.string().describe("The amount of tokens to stake in base units (18 decimals)"),
    tokenType: TokenType,
});

const GetStakeInfoSchema = z.object({
    tokenType: TokenType.describe("The type of token to get info for (MODE or BPT)"),
});

const GetBalanceSchema = z.object({
    tokenType: ExtendedTokenType.describe(
        "The type of token to get balance for: 'veMode'/'veBPT' for voting power, 'MODE'/'BPT' for token balances",
    ),
    address: z
        .string()
        .optional()
        .describe("The address to check balance for. If not provided, uses the wallet's address"),
});

export class ExecuteGovernanceStakeParameters extends createToolParameters(StakeSchema) {}
export class GetModeGovernanceInfoParameters extends createToolParameters(GetStakeInfoSchema) {}
export class GetBalanceParameters extends createToolParameters(GetBalanceSchema) {}
